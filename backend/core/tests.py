import copy
import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from unittest import skipUnless
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from django.conf import settings
from django.core import mail
from django.core.exceptions import ValidationError
from django.db import connection, close_old_connections
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from .models import User, Progress, ThrottleBucket, EmailChallenge
from .validation import validate_state

PASSWORD = 'A-long-test-password!47'

def confirmed_login(client,user):
    # Explicit test fixture only. Production sets this flag exclusively after
    # consuming an emailed challenge, never through password-only login.
    if user.email_verified_at is None:
        user.email_verified_at=timezone.now();user.save(update_fields=['email_verified_at'])
    client.force_login(user)
    session=client.session;session['email_confirmed_uid']=str(user.pk);session['email_confirmed_email']=user.email;session.save()

def emailed_confirmation():
    link=re.search(r'https://\S+',mail.outbox[-1].body).group(0)
    assert '/#confirm-email?' in link
    params=parse_qs(urlparse(link).fragment.split('?',1)[1])
    return {'challengeId':params['challenge'][0],'token':params['token'][0]}

def state_fixture():
    today = date.today().isoformat()
    deadline = (date.today()+timedelta(weeks=8)).isoformat()
    return {'version':4,'profile':{'startDate':today,'deadline':deadline,'startWeight':75,'goalLoss':0,
        'goalType':'curves','name':'Test athlete','experience':'beginner','days':[1,3,5],
        'sessionMinutes':20,'durationWeeks':8,'targetValue':24,'baselineValue':12,'targetUnit':'reps',
        'ageBand':'adult','lowImpact':True,'restrictions':['wrist'],'coaching':'supportive',
        'equipment':['chair','wall'],'trackMeasurements':True,'safetyAccepted':True,'heightCm':165,
        'gender':'female','motivation':'health','focusAreas':['glutes','core'],'birthYear':1991,
        'location':'home','cardioComfort':'mild','flexibility':'near','feelings':['confidence'],
        'reward':'trip','onboardingComplete':True},
        'weights':[{'date':today,'weight':75,'waist':82}],
        'bodyMeasurements':[{'date':today,'waist':82,'hips':101}],
        'workouts':[{'id':'workout-1','date':today,'session':'personalized','seconds':600,'skipped':0,
            'title':'Glutes and control','goalType':'curves','routineId':'custom-1','programId':'curves-eight',
            'difficultyFeedback':'just-right','kcal':50,'kcalSource':'estimated','kcalWeight':75,
            'kcalMET':2.8,'kcalAge':35,'effort':5,'soreness':2}],
        'walks':[{'id':'walk-1','date':today,'minutes':10,'intensity':'brisk'}],
        'assessments':[{'date':today,'value':15,'goalType':'curves','unit':'reps','notes':'Private note','time':90}],
        'favorites':['custom-1','glutes-floor'],
        'customRoutines':[{'id':'custom-1','name':'My glute routine','warmup':60,'cooldown':60,
            'movements':[{'exercise':'bridge','work':30,'rest':15,'rounds':2}]}],
        'activeProgram':{'id':'curves-eight','instanceId':'program-1','startDate':today,'durationWeeks':8,'routineId':'glutes-floor'},
        'settings':{'voice':True,'energy':{'enabled':True,'age':35,'weight':75,'intensity':'light'},
            'reminders':{'enabled':True,'time':'18:00','days':[1,3,5],'lastNotified':today+'T18:00'}},'sound':True}

class APITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('athlete@example.test',PASSWORD,display_name='Athlete')
        self.other = User.objects.create_user('other@example.test',PASSWORD,display_name='Other')
        self.owner = User.objects.create_superuser('owner@example.test',PASSWORD,display_name='Owner')
        confirmed_login(self.client,self.user)
        self.client.defaults['HTTP_X_FORM_USER']=str(self.user.pk)

    def request(self, method, path, body=None, client=None, **headers):
        return getattr(client or self.client,method)(path,json.dumps(body or {}),content_type='application/json',**headers)

    def test_anonymous_session_csrf_and_login_rotation(self):
        client=Client(enforce_csrf_checks=True)
        session=client.get('/api/auth/session/')
        self.assertIsNone(session.json()['user'])
        self.assertIn('no-store',session['Cache-Control'])
        csrf=session.json()['csrfToken']
        rejected=self.request('post','/api/auth/login/',{'email':self.user.email,'password':PASSWORD},client)
        self.assertEqual(rejected.status_code,403)
        self.assertEqual(rejected.json()['code'],'auth/csrf')
        response=self.request('post','/api/auth/login/',{'email':self.user.email,'password':PASSWORD},client,HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code,202)
        self.assertTrue(response.json()['confirmationRequired'])
        self.assertIsNone(client.get('/api/auth/session/').json()['user'])
        self.assertNotIn('token',response.json())
        response=self.request('post','/api/auth/confirm-email/',emailed_confirmation(),client,HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code,200,response.content)
        self.assertNotEqual(response.json()['csrfToken'],csrf)
        self.assertEqual(response.json()['user']['uid'],str(self.user.pk))
        self.assertFalse(response.json()['user']['isAdmin'])
        self.assertTrue(response.cookies['sessionid']['httponly'])
        self.assertEqual(response.cookies['sessionid']['samesite'],'Lax')
        self.assertEqual(self.request('post','/api/auth/logout/',{},client,HTTP_X_CSRFTOKEN=csrf).status_code,403)
        self.assertEqual(self.request('post','/api/auth/logout/',{},client,HTTP_X_CSRFTOKEN=response.json()['csrfToken']).status_code,200)

    def test_csrf_required_for_progress_and_account_deletion(self):
        client=Client(enforce_csrf_checks=True);client.force_login(self.user)
        for method,path,body in [('put','/api/progress/',{'state':state_fixture(),'baseRevision':0}),
                ('delete','/api/progress/',{}),('post','/api/auth/delete-account/',{'password':PASSWORD})]:
            with self.subTest(path=path,method=method):
                self.assertEqual(self.request(method,path,body,client).status_code,403)
        self.assertTrue(User.objects.filter(pk=self.user.pk).exists())

    def test_signup_requires_consent_and_hashes_password(self):
        client=Client();body={'email':' NEW@Example.Test ','password':PASSWORD,'displayName':' New athlete ',
            'isAdmin':True,'is_staff':True}
        self.assertEqual(self.request('post','/api/auth/signup/',body,client).status_code,400)
        body['trackingConsent']=True
        response=self.request('post','/api/auth/signup/',body,client)
        self.assertEqual(response.status_code,202,response.content)
        user=User.objects.get(email='new@example.test')
        self.assertNotEqual(user.password,PASSWORD);self.assertTrue(user.check_password(PASSWORD))
        self.assertFalse(user.is_staff);self.assertFalse(user.is_superuser)
        self.assertIsNotNone(user.tracking_consent_at)
        self.assertEqual(user.tracking_consent_version,'progress-v1')
        self.assertIsNone(user.email_verified_at)
        self.assertIsNone(client.get('/api/auth/session/').json()['user'])
        confirmed=self.request('post','/api/auth/confirm-email/',emailed_confirmation(),client)
        self.assertEqual(confirmed.status_code,200)
        self.assertTrue(confirmed.json()['user']['emailVerified'])
        self.assertEqual(self.request('post','/api/auth/signup/',body,client).status_code,400)

    def test_password_policy_and_wrong_login_do_not_enumerate(self):
        client=Client()
        short=self.request('post','/api/auth/signup/',{'email':'short@example.test','password':'a1B!','trackingConsent':True},client)
        self.assertEqual(short.status_code,400)
        known=self.request('post','/api/auth/login/',{'email':self.user.email,'password':'wrong'},client)
        unknown=self.request('post','/api/auth/login/',{'email':'missing@example.test','password':'wrong'},client)
        self.assertEqual(known.status_code,401);self.assertEqual(known.json(),unknown.json())

    def test_self_round_trip_preserves_all_current_metadata(self):
        state=state_fixture()
        saved=self.request('put','/api/progress/',{'state':state,'baseRevision':0,'uid':str(self.other.pk)})
        self.assertEqual(saved.status_code,200,saved.content)
        self.assertEqual(saved.json()['revision'],1)
        self.assertEqual(saved.json()['state'],state)
        self.assertEqual(self.client.get('/api/progress/').json()['state'],state)
        self.assertFalse(Progress.objects.filter(user=self.other).exists())

    def test_revision_conflict_preserves_saved_snapshot(self):
        original=state_fixture()
        self.request('put','/api/progress/',{'state':original,'baseRevision':0})
        changed=copy.deepcopy(original);changed['profile']['name']='Other tab'
        stale=self.request('put','/api/progress/',{'state':changed,'baseRevision':0})
        self.assertEqual(stale.status_code,409)
        self.assertEqual(stale.json()['fields']['currentRevision'],1)
        self.assertEqual(Progress.objects.get(user=self.user).state,original)
        self.assertEqual(self.request('put','/api/progress/',{'state':changed,'baseRevision':1}).json()['revision'],2)

    def test_empty_head_and_deletion_tombstone_prevent_stale_recreation(self):
        self.assertIsNone(self.client.get('/api/progress/').json())
        self.request('put','/api/progress/',{'state':state_fixture(),'baseRevision':0})
        self.assertEqual(self.request('delete','/api/progress/',{'baseRevision':0}).status_code,409)
        deleted=self.request('delete','/api/progress/',{'baseRevision':1})
        self.assertEqual(deleted.json()['revision'],2);self.assertIsNone(deleted.json()['state'])
        self.assertEqual(self.client.get('/api/progress/').json()['revision'],2)
        self.assertEqual(self.request('put','/api/progress/',{'state':state_fixture(),'baseRevision':1}).status_code,409)

    def test_invalid_schema_and_duplicate_activity_are_not_saved(self):
        state=state_fixture()
        mutations=[lambda s:s.update(version=3),lambda s:s['walks'][0].update(id='workout-1'),
            lambda s:s['profile'].update(ageBand='teen'),lambda s:s['customRoutines'][0].update(name='<script>'),
            lambda s:s['profile'].update(goalType=['curves']),lambda s:s['workouts'][0].update(seconds=float('inf')),
            lambda s:s['bodyMeasurements'][0].update(hips=1),lambda s:s.update(privateToken='bad')]
        for mutate in mutations:
            value=copy.deepcopy(state);mutate(value)
            with self.subTest(state=value):
                self.assertEqual(self.request('put','/api/progress/',{'state':value,'baseRevision':0}).status_code,400)
        self.assertFalse(Progress.objects.filter(user=self.user).exists())

    def test_large_payload_and_bad_json_have_json_errors(self):
        too_large=self.client.put('/api/progress/',b' '+b'x'*(settings.DATA_UPLOAD_MAX_MEMORY_SIZE+1),content_type='application/json')
        self.assertEqual(too_large.status_code,413)
        self.assertEqual(too_large.json()['code'],'api/payload-too-large')
        bad=self.client.put('/api/progress/','{"state":NaN}',content_type='application/json')
        self.assertEqual(bad.status_code,400)
        self.assertEqual(self.client.put('/api/progress/','a=1',content_type='text/plain').status_code,415)

    def test_anonymous_and_non_owner_cannot_read_directory_or_other_progress(self):
        self.assertEqual(Client().get('/api/progress/').status_code,401)
        self.assertEqual(Client().get('/api/owner/users/').status_code,401)
        self.assertEqual(self.client.get('/api/owner/users/').status_code,403)
        self.assertEqual(self.client.get(f'/api/owner/users/{self.other.pk}/progress/').status_code,403)

    def test_owner_summary_uses_real_activity_and_excludes_sensitive_details(self):
        state=state_fixture();state['workouts'].append({'id':'partial','date':date.today().isoformat(),
            'session':'foundation','seconds':120,'skipped':1})
        state['assessments'].append({'date':date.today().isoformat(),'value':75,'unit':'kg','goalType':'weight'})
        self.request('put','/api/progress/',{'state':state,'baseRevision':0})
        confirmed_login(self.client,self.owner)
        self.client.defaults['HTTP_X_FORM_USER']=str(self.owner.pk)
        directory=self.client.get('/api/owner/users/?search=athlete').json()
        self.assertEqual(directory['total'],1)
        row=directory['users'][0]
        self.assertEqual(row['completedWorkouts'],1);self.assertEqual(row['totalMinutes'],22);self.assertEqual(row['streak'],1)
        detail=self.client.get(f'/api/owner/users/{self.user.pk}/progress/').json()
        serialized=json.dumps(detail)
        for private in ['bodyMeasurements','weights','startWeight','heightCm','restrictions','gender','birthYear','kcalWeight','kcalAge','Private note','soreness','effort']:
            self.assertNotIn(private,serialized)
        self.assertEqual(len(detail['assessments']),1)
        self.assertEqual(detail['assessments'][0]['unit'],'reps')
        self.assertEqual(detail['profile']['targetValue'],24)

    def test_weight_goal_never_exposes_weight_target_or_assessment(self):
        state=state_fixture();state['profile'].update(goalType='weight',targetUnit='kg',targetValue=70,baselineValue=75)
        state['assessments']=[{'date':date.today().isoformat(),'value':75,'unit':'kg','goalType':'weight'}]
        self.request('put','/api/progress/',{'state':state,'baseRevision':0})
        confirmed_login(self.client,self.owner)
        self.client.defaults['HTTP_X_FORM_USER']=str(self.owner.pk)
        detail=self.client.get(f'/api/owner/users/{self.user.pk}/progress/').json()
        self.assertNotIn('targetValue',detail['profile']);self.assertNotIn('baselineValue',detail['profile'])
        self.assertEqual(detail['assessments'],[])

    def test_signed_owner_pagination_and_server_role(self):
        confirmed_login(self.client,self.owner)
        self.client.defaults['HTTP_X_FORM_USER']=str(self.owner.pk)
        first=self.client.get('/api/owner/users/?pageSize=1').json()
        self.assertEqual(len(first['users']),1);self.assertTrue(first['nextCursor'])
        second=self.client.get('/api/owner/users/',{'pageSize':1,'cursor':first['nextCursor']}).json()
        self.assertNotEqual(first['users'][0]['uid'],second['users'][0]['uid'])
        self.assertEqual(self.client.get('/api/owner/users/?cursor=forged').status_code,400)
        self.owner.is_staff=False;self.owner.is_superuser=False;self.owner.save()
        self.assertEqual(self.client.get('/api/owner/users/').status_code,403)

    @override_settings(SESSION_COOKIE_SECURE=True,CSRF_COOKIE_SECURE=True)
    def test_production_cookie_flags_and_cross_origin_csrf(self):
        client=Client(enforce_csrf_checks=True)
        initial=client.get('/api/auth/session/',secure=True)
        self.assertTrue(initial.cookies['csrftoken']['secure'])
        csrf=initial.json()['csrfToken']
        body={'email':self.user.email,'password':PASSWORD}
        rejected=self.request('post','/api/auth/login/',body,client,HTTP_X_CSRFTOKEN=csrf,HTTP_ORIGIN='https://attacker.example.test',secure=True)
        self.assertEqual(rejected.status_code,403)
        accepted=self.request('post','/api/auth/login/',body,client,HTTP_X_CSRFTOKEN=csrf,HTTP_ORIGIN='https://testserver',secure=True)
        self.assertEqual(accepted.status_code,202)
        accepted=self.request('post','/api/auth/confirm-email/',emailed_confirmation(),client,HTTP_X_CSRFTOKEN=csrf,HTTP_ORIGIN='https://testserver',secure=True)
        self.assertEqual(accepted.status_code,200)
        self.assertTrue(accepted.cookies['sessionid']['secure'])
        self.assertTrue(accepted.cookies['sessionid']['httponly'])

    def test_password_reset_response_and_single_use_confirmation(self):
        client=Client()
        known=self.request('post','/api/auth/password-reset/',{'email':self.user.email},client)
        unknown=self.request('post','/api/auth/password-reset/',{'email':'missing@example.test'},client)
        self.assertEqual(known.status_code,202);self.assertEqual(known.json(),unknown.json())
        self.assertEqual(len(mail.outbox),1)
        link=re.search(r'https://\S+',mail.outbox[0].body).group(0)
        self.assertIn('/#reset-confirm?',link)
        params=parse_qs(urlparse(link).fragment.split('?',1)[1])
        body={'uid':params['uid'][0],'token':params['token'][0],'password':'Another-strong-pass!92'}
        self.assertEqual(self.request('post','/api/auth/password-reset-confirm/',body,client).status_code,200)
        self.assertEqual(self.request('post','/api/auth/password-reset-confirm/',body,client).status_code,400)
        self.user.refresh_from_db();self.assertTrue(self.user.check_password(body['password']))
        self.assertEqual(self.request('post','/api/auth/password-reset-confirm/',{'uid':'bad','token':'bad','password':PASSWORD},client).json()['code'],'auth/invalid-reset')

    @override_settings(DEFAULT_FROM_EMAIL='')
    def test_missing_email_is_explicit_for_all_addresses(self):
        for email in [self.user.email,'missing@example.test']:
            self.assertEqual(self.request('post','/api/auth/password-reset/',{'email':email}).status_code,503)

    def test_account_deletion_verifies_password_and_cascades(self):
        self.request('put','/api/progress/',{'state':state_fixture(),'baseRevision':0})
        self.assertEqual(self.request('post','/api/auth/delete-account/',{'password':'wrong'}).status_code,401)
        self.assertTrue(Progress.objects.filter(user=self.user).exists())
        self.assertEqual(self.request('post','/api/auth/delete-account/',{'password':PASSWORD}).status_code,200)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())
        self.assertFalse(Progress.objects.filter(user_id=self.user.pk).exists())
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])

    def test_account_binding_rejects_old_tab_after_cookie_switch(self):
        confirmed_login(self.client,self.other)
        # Existing defaults still carry the prior tab's authenticated UID.
        for method in ['get','put','delete']:
            with self.subTest(method=method):
                response=self.client.get('/api/progress/') if method=='get' else self.request(method,'/api/progress/',{'state':state_fixture(),'baseRevision':0})
                self.assertEqual(response.status_code,401)
                self.assertEqual(response.json()['code'],'auth/session-changed')
        self.assertFalse(Progress.objects.filter(user=self.other).exists())
        self.client.defaults.pop('HTTP_X_FORM_USER')
        self.assertEqual(self.client.get('/api/progress/').json()['code'],'auth/session-changed')
        confirmed_login(self.client,self.owner)
        self.client.defaults['HTTP_X_FORM_USER']=str(self.user.pk)
        self.assertEqual(self.client.get('/api/owner/users/').json()['code'],'auth/session-changed')
        self.assertEqual(self.client.get(f'/api/owner/users/{self.other.pk}/progress/').json()['code'],'auth/session-changed')

    @override_settings(AUTH_THROTTLE_LIMIT=1)
    def test_rate_limits_are_database_backed(self):
        client=Client();body={'email':self.user.email,'password':'wrong'}
        self.assertEqual(self.request('post','/api/auth/login/',body,client).status_code,401)
        self.assertEqual(self.request('post','/api/auth/login/',body,client).status_code,429)
        self.assertEqual(ThrottleBucket.objects.count(),2)
        self.assertNotIn(self.user.email,''.join(ThrottleBucket.objects.values_list('key',flat=True)))

    def test_health_and_pwa_are_served_at_same_origin(self):
        self.assertEqual(Client().get('/api/health/').json(),{'status':'ok','database':'ok'})
        self.assertEqual(Client().get('/').status_code,200)
        self.assertEqual(Client().get('/manifest.webmanifest').status_code,200)
        self.assertEqual(Client().get('/auth.js').status_code,200)

    def test_abs_and_optional_pelvic_preferences_round_trip_privately(self):
        state=state_fixture();state['profile']['goalType']='abs'
        state['settings']['pelvic']={'guide':'men','experience':'new','comfortableHold':3,'week':1,'quickReps':False,'adviceAccepted':True}
        state['workouts'].append({'id':'pelvic-private-1','date':date.today().isoformat(),'session':'personalized','seconds':120,'skipped':0,
            'title':'Pelvic floor practice','goalType':'core','routineId':'pelvic-floor'})
        saved=self.request('put','/api/progress/',{'state':state,'baseRevision':0})
        self.assertEqual(saved.status_code,200,saved.content)
        self.assertEqual(saved.json()['state'],state)
        confirmed_login(self.client,self.owner);self.client.defaults['HTTP_X_FORM_USER']=str(self.owner.pk)
        detail=self.client.get(f'/api/owner/users/{self.user.pk}/progress/').json()
        wellness=detail['workouts'][-1]
        self.assertEqual(wellness['title'],'Private wellness session')
        self.assertTrue(wellness['id'].startswith('session-'))
        self.assertNotIn('routineId',wellness)
        for private in ['pelvic-floor','pelvic-private-1','Pelvic floor practice','comfortableHold','adviceAccepted']:
            self.assertNotIn(private,json.dumps(detail))

    def test_adult_abs_goal_and_pelvic_preferences_are_validated(self):
        mutations=[lambda s:s['profile'].update(goalType='abs',ageBand='teen',birthYear=None),
            lambda s:s['settings'].update(pelvic={'guide':'invalid'}),
            lambda s:s['settings'].update(pelvic={'comfortableHold':11}),
            lambda s:s['settings'].update(pelvic={'week':0}),
            lambda s:s['settings'].update(pelvic={'quickReps':'true'}),
            lambda s:s['settings'].update(pelvic={'clinicalSymptoms':True})]
        for mutate in mutations:
            state=state_fixture();mutate(state)
            with self.subTest(state=state):
                self.assertEqual(self.request('put','/api/progress/',{'state':state,'baseRevision':0}).status_code,400)
        self.assertFalse(Progress.objects.filter(user=self.user).exists())

    def test_malformed_pelvic_enums_fail_with_validation_and_json_400(self):
        for field in ['guide','experience']:
            for value in [[],{},None,True,3]:
                with self.subTest(field=field,value=value):
                    state=state_fixture();state['settings']['pelvic']={field:value}
                    with self.assertRaises(ValidationError): validate_state(state)
                    response=self.request('put','/api/progress/',{'state':state,'baseRevision':0})
                    self.assertEqual(response.status_code,400,response.content)
                    self.assertEqual(response.json()['code'],'api/validation')
        self.assertFalse(Progress.objects.filter(user=self.user).exists())

@skipUnless(connection.vendor=='postgresql','Requires disposable PostgreSQL TEST_DATABASE_URL.')
class PostgreSQLConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.user=User.objects.create_user('concurrent@example.test',PASSWORD)

    def test_two_first_saves_accept_exactly_one_revision(self):
        # Separate database connections and genuine concurrent requests exercise
        # PostgreSQL row locks, including absent initial Progress rows.
        import threading
        barrier=threading.Barrier(2)
        def write(name):
            close_old_connections()
            client=Client();confirmed_login(client,User.objects.get(pk=self.user.pk))
            state=state_fixture();state['profile']['name']=name
            barrier.wait(timeout=10)
            response=client.put('/api/progress/',json.dumps({'state':state,'baseRevision':0}),content_type='application/json',HTTP_X_FORM_USER=str(self.user.pk))
            close_old_connections()
            return response.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes=list(pool.map(write,['One','Two']))
        self.assertEqual(sorted(codes),[200,409])
        row=Progress.objects.get(user=self.user)
        self.assertEqual(row.revision,1);self.assertIn(row.state['profile']['name'],['One','Two'])

    def test_concurrent_confirmation_consumes_link_exactly_once(self):
        import threading
        from .confirmations import issue
        issue(self.user,'login',PASSWORD);body=emailed_confirmation()
        barrier=threading.Barrier(2)
        def confirm(_):
            close_old_connections();client=Client();barrier.wait(timeout=10)
            response=client.post('/api/auth/confirm-email/',json.dumps(body),content_type='application/json')
            close_old_connections();return response.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes=list(pool.map(confirm,[1,2]))
        self.assertEqual(sorted(codes),[200,400])
        self.assertIsNotNone(EmailChallenge.objects.get(pk=body['challengeId']).consumed_at)

    def test_concurrent_delete_and_stale_save_preserve_revision(self):
        import threading
        Progress.objects.create(user=self.user,state=state_fixture(),revision=1)
        barrier=threading.Barrier(2)
        def mutate(action):
            close_old_connections();client=Client();confirmed_login(client,User.objects.get(pk=self.user.pk))
            barrier.wait(timeout=10)
            body={'baseRevision':1}
            if action=='put': body['state']=state_fixture()
            response=getattr(client,action)('/api/progress/',json.dumps(body),content_type='application/json',HTTP_X_FORM_USER=str(self.user.pk))
            close_old_connections();return response.status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes=list(pool.map(mutate,['delete','put']))
        self.assertEqual(sorted(codes),[200,409])
        self.assertEqual(Progress.objects.get(user=self.user).revision,2)

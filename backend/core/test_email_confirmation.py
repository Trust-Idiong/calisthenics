import json
from datetime import timedelta
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse
from django.core import mail
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from .models import User, EmailChallenge, Progress
from .tests import PASSWORD, confirmed_login, emailed_confirmation

class EmailConfirmationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('athlete@example.test', PASSWORD)

    def post(self, path, body, client=None):
        return (client or self.client).post('/api/auth/' + path + '/', json.dumps(body), content_type='application/json')

    def start(self, client=None):
        response = self.post('login', {'email': self.user.email, 'password': PASSWORD}, client)
        self.assertEqual(response.status_code, 202, response.content)
        return response.json(), emailed_confirmation()

    def test_password_alone_never_creates_session_and_challenge_contains_no_secret(self):
        body, token = self.start()
        self.assertEqual(set(body), {'confirmationRequired','challengeId','maskedEmail','expiresAt','resendAfter'})
        self.assertTrue(body['confirmationRequired'])
        self.assertEqual(body['maskedEmail'], 'a***@example.test')
        self.assertLessEqual(body['resendAfter'], 60)
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])
        self.assertEqual(self.client.get('/api/progress/', HTTP_X_FORM_USER=str(self.user.pk)).status_code, 401)
        challenge = EmailChallenge.objects.get(pk=body['challengeId'])
        self.assertEqual(len(token['token']), 43)
        self.assertEqual(len(challenge.token_digest), 64)
        self.assertNotIn(token['token'], json.dumps(body))
        self.assertNotIn(token['token'], str(challenge.__dict__))
        self.assertAlmostEqual((challenge.expires_at-challenge.created_at).total_seconds(), 900, delta=2)

    def test_confirm_is_single_use_and_every_new_login_requires_another_link(self):
        _, token = self.start()
        confirmed = self.post('confirm-email', token)
        self.assertEqual(confirmed.status_code, 200)
        self.assertTrue(confirmed.json()['user']['emailVerified'])
        self.assertEqual(self.client.session['email_confirmed_uid'], str(self.user.pk))
        self.assertEqual(self.client.session['email_confirmed_email'], self.user.email)
        replay = self.post('confirm-email', token, Client())
        self.assertEqual(replay.status_code, 400)
        self.post('logout', {})
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])
        _, second = self.start()
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])
        self.assertNotEqual(token['challengeId'], second['challengeId'])
        self.assertEqual(self.post('confirm-email', second).status_code, 200)

    def test_confirmation_can_finish_in_another_browser(self):
        _, token = self.start()
        other = Client()
        self.assertEqual(self.post('confirm-email', token, other).status_code, 200)
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])
        self.assertEqual(other.get('/api/auth/session/').json()['user']['uid'], str(self.user.pk))

    def test_new_login_invalidates_previous_outstanding_link(self):
        _, first = self.start()
        _, second = self.start()
        self.assertEqual(self.post('confirm-email', first).status_code, 400)
        self.assertEqual(self.post('confirm-email', second).status_code, 200)

    def test_expired_inactive_and_changed_credentials_reject_confirmation(self):
        for mutation in ['expired','inactive','password','email']:
            with self.subTest(mutation=mutation):
                self.user.is_active=True;self.user.email='athlete@example.test';self.user.set_password(PASSWORD);self.user.save()
                _, token=self.start()
                if mutation=='expired':
                    EmailChallenge.objects.filter(pk=token['challengeId']).update(expires_at=timezone.now()-timedelta(seconds=1))
                elif mutation=='inactive':
                    self.user.is_active=False;self.user.save(update_fields=['is_active'])
                elif mutation=='password':
                    self.user.set_password('Changed-password!39');self.user.save(update_fields=['password'])
                else:
                    self.user.email='changed@example.test';self.user.save(update_fields=['email'])
                self.assertEqual(self.post('confirm-email',token).status_code,400)
                self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])

    def test_wrong_token_attempts_are_durable_and_bounded(self):
        _, token=self.start()
        for attempt in range(8):
            bad={**token,'token':'a'*43}
            self.assertEqual(self.post('confirm-email',bad).status_code,400)
        challenge=EmailChallenge.objects.get(pk=token['challengeId'])
        self.assertEqual(challenge.failed_attempts,8)
        self.assertIsNotNone(challenge.consumed_at)
        self.assertEqual(self.post('confirm-email',token).status_code,400)

    def test_malformed_challenges_are_json_errors(self):
        for body in [{},{'challengeId':'bad','token':'bad'},{'challengeId':[], 'token':[]}]:
            with self.subTest(body=body):
                response=self.post('confirm-email',body)
                self.assertEqual(response.status_code,400)
                self.assertEqual(response.json()['code'],'auth/invalid-confirmation')

    def test_resend_wait_rotates_old_token_and_resend_limit(self):
        body, first=self.start()
        immediate=self.post('resend-confirmation',{'challengeId':body['challengeId']})
        self.assertEqual(immediate.status_code,429)
        self.assertGreater(immediate.json()['fields']['resendAfter'],0)
        EmailChallenge.objects.filter(pk=body['challengeId']).update(last_sent_at=timezone.now()-timedelta(seconds=61))
        self.assertEqual(self.post('resend-confirmation',{'challengeId':body['challengeId']}).status_code,202)
        second=emailed_confirmation()
        self.assertEqual(first['challengeId'],second['challengeId'])
        self.assertNotEqual(first['token'],second['token'])
        self.assertEqual(self.post('confirm-email',first).status_code,400)
        EmailChallenge.objects.filter(pk=body['challengeId']).update(send_count=5,last_sent_at=timezone.now()-timedelta(seconds=61))
        self.assertEqual(self.post('resend-confirmation',{'challengeId':body['challengeId']}).status_code,429)
        self.assertEqual(self.post('confirm-email',second).status_code,200)
        self.assertEqual(self.post('resend-confirmation',{'challengeId':body['challengeId']}).status_code,400)

    @override_settings(DEFAULT_FROM_EMAIL='')
    def test_unconfigured_email_blocks_signup_and_login(self):
        signup=self.post('signup',{'email':'new@example.test','password':PASSWORD,'trackingConsent':True})
        login=self.post('login',{'email':self.user.email,'password':PASSWORD})
        for response in [signup,login]:
            self.assertEqual(response.status_code,503)
            self.assertEqual(response.json()['code'],'auth/email-unavailable')
        self.assertFalse(User.objects.filter(email='new@example.test').exists())
        self.assertEqual(EmailChallenge.objects.count(),0)

    @override_settings(EMAIL_BACKEND='core.email_backend.BrevoEmailBackend',BREVO_API_KEY='',BREVO_SENDER_EMAIL='sender@example.test')
    def test_brevo_credentials_are_required_before_sending(self):
        self.assertEqual(self.post('login',{'email':self.user.email,'password':PASSWORD}).status_code,503)
        self.assertEqual(EmailChallenge.objects.count(),0)

    @override_settings(EMAIL_BACKEND='core.email_backend.BrevoEmailBackend',BREVO_API_KEY='PRIVATE-TEST-KEY',BREVO_SENDER_EMAIL='verified@example.test')
    def test_signup_to_confirmation_through_mocked_brevo_transport(self):
        accepted=MagicMock();accepted.status=201;accepted.read.return_value=b'{"messageId":"accepted-test-message"}'
        accepted.__enter__.return_value=accepted
        with patch('core.email_backend.build_opener') as factory:
            factory.return_value.open.return_value=accepted
            response=self.post('signup',{'email':'new@example.test','password':PASSWORD,'trackingConsent':True})
        self.assertEqual(response.status_code,202)
        message=json.loads(factory.return_value.open.call_args.args[0].data)
        link=next(line for line in message['textContent'].splitlines() if line.startswith('https://'))
        self.assertEqual(urlparse(link).query,'')
        values=parse_qs(urlparse(link).fragment.split('?',1)[1])
        self.assertNotIn('PRIVATE-TEST-KEY',response.content.decode())
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])
        confirmed=self.post('confirm-email',{'challengeId':values['challenge'][0],'token':values['token'][0]})
        self.assertEqual(confirmed.status_code,200)
        self.assertEqual(confirmed.json()['user']['email'],'new@example.test')

    @patch('core.confirmations.send_mail',side_effect=RuntimeError('PRIVATE-provider-error-should-not-appear'))
    def test_confirmation_transport_failure_rolls_back_account_and_challenge(self,send):
        with self.assertLogs('core.confirmations',level='ERROR') as logs:
            signup=self.post('signup',{'email':'new@example.test','password':PASSWORD,'trackingConsent':True})
            signin=self.post('login',{'email':self.user.email,'password':PASSWORD})
        self.assertEqual(signup.status_code,503);self.assertEqual(signin.status_code,503)
        self.assertFalse(User.objects.filter(email='new@example.test').exists())
        self.assertEqual(EmailChallenge.objects.count(),0)
        self.assertEqual(Progress.objects.count(),0)
        self.assertNotIn('PRIVATE',str(logs.output)+signup.content.decode()+signin.content.decode())
        self.assertNotIn(self.user.email,str(logs.output))
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])

    def test_failed_resend_retains_previous_challenge(self):
        body,token=self.start()
        EmailChallenge.objects.filter(pk=body['challengeId']).update(last_sent_at=timezone.now()-timedelta(seconds=61))
        with patch('core.confirmations.send_mail',return_value=0), self.assertLogs('core.confirmations',level='ERROR'):
            self.assertEqual(self.post('resend-confirmation',{'challengeId':body['challengeId']}).status_code,503)
        self.assertEqual(self.post('confirm-email',token).status_code,200)

    def test_password_only_session_cannot_use_api_or_django_admin(self):
        self.user.is_staff=True;self.user.is_superuser=True;self.user.save()
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/owner/users/',HTTP_X_FORM_USER=str(self.user.pk)).status_code,401)
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/admin/login/').url,'/#login')
        self.assertNotIn('_auth_user_id',self.client.session)
        _,token=self.start()
        self.assertEqual(self.post('confirm-email',token).status_code,200)
        self.assertEqual(self.client.get('/admin/').status_code,200)
        self.assertEqual(self.client.get('/admin/core/user/add/').status_code,200)

    def test_email_change_invalidates_already_confirmed_session(self):
        confirmed_login(self.client,self.user)
        User.objects.filter(pk=self.user.pk).update(email='changed@example.test')
        response=self.client.get('/api/progress/',HTTP_X_FORM_USER=str(self.user.pk))
        self.assertEqual(response.status_code,401)
        self.assertEqual(response.json()['code'],'auth/confirmation-required')
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])

    def test_confirmation_and_resend_require_csrf(self):
        _,token=self.start()
        strict=Client(enforce_csrf_checks=True)
        self.assertEqual(self.post('confirm-email',token,strict).status_code,403)
        self.assertEqual(self.post('resend-confirmation',{'challengeId':token['challengeId']},strict).status_code,403)

    def test_password_reset_failure_is_non_enumerating_and_creates_no_session(self):
        with patch('core.views.send_mail',side_effect=RuntimeError('PRIVATE')),self.assertLogs('core.views',level='ERROR'):
            known=self.post('password-reset',{'email':self.user.email})
        unknown=self.post('password-reset',{'email':'missing@example.test'})
        self.assertEqual(known.status_code,202);self.assertEqual(known.json(),unknown.json())
        self.assertIsNone(self.client.get('/api/auth/session/').json()['user'])

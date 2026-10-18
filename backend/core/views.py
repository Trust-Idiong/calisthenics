import json
import hashlib
import hmac
import logging
from datetime import date, timedelta
from functools import wraps
from urllib.parse import urlencode
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.core.exceptions import ValidationError, RequestDataTooBig
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import connection, transaction, IntegrityError
from django.db.models import Q
from django.http import JsonResponse, FileResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from .models import User, Progress
from .throttle import consume
from .validation import validate_state, number, text
from .errors import APIError
from . import confirmations

logger = logging.getLogger(__name__)

def failure(code, message, status=400, fields=None):
    body={'code':code,'message':message}
    if fields: body['fields']=fields
    return JsonResponse(body,status=status)

def csrf_failure(request, reason=''):
    return failure('auth/csrf','Refresh the session and retry with its CSRF token.',403)

def endpoint(methods, authenticated=False, owner=False, account_bound=False):
    def decorate(view):
        @wraps(view)
        def wrapped(request,*args,**kwargs):
            if request.method not in methods:
                response=failure('api/method-not-allowed','This request method is not supported.',405)
                response['Allow']=', '.join(methods);return response
            if authenticated and not request.user.is_authenticated:
                return failure('auth/not-signed-in','Sign in to access your saved progress.',401)
            if authenticated and not confirmations.session_is_confirmed(request):
                logout(request)
                return failure('auth/confirmation-required','Confirm a new sign-in email before accessing your account.',401)
            if account_bound and request.headers.get('X-FORM-User') != str(request.user.pk):
                return failure('auth/session-changed','Your account changed. Reload your account before accessing saved progress.',401)
            if owner and not (request.user.is_active and (request.user.is_staff or request.user.is_superuser)):
                return failure('owner/forbidden','Owner access is required.',403)
            try:
                return view(request,*args,**kwargs)
            except APIError as error:
                return failure(error.code,error.message,error.status,error.fields)
            except ValidationError as error:
                return failure('api/validation','Review the supplied values.',400,{'details':error.messages})
        return wrapped
    return decorate

def payload(request):
    if request.content_type!='application/json': raise APIError('api/json-required','Send an application/json request.',415)
    try:
        if int(request.META.get('CONTENT_LENGTH') or 0)>settings.DATA_UPLOAD_MAX_MEMORY_SIZE: raise APIError('api/payload-too-large','This progress payload exceeds 8 MiB. Keep the local backup.',413)
        raw=request.body
        if len(raw)>settings.DATA_UPLOAD_MAX_MEMORY_SIZE: raise APIError('api/payload-too-large','This progress payload exceeds 8 MiB. Keep the local backup.',413)
        data=json.loads(raw or b'{}',parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
    except APIError: raise
    except RequestDataTooBig: raise APIError('api/payload-too-large','This progress payload exceeds 8 MiB. Keep the local backup.',413)
    except (ValueError,UnicodeDecodeError,RecursionError): raise APIError('api/invalid-json','Supply a valid JSON object.')
    if not isinstance(data,dict): raise APIError('api/invalid-json','Supply a JSON object.')
    return data

def email_value(value):
    if not isinstance(value,str): raise APIError('auth/invalid-email','Enter a valid email address.')
    value=value.strip().lower()
    try: validate_email(value)
    except ValidationError: raise APIError('auth/invalid-email','Enter a valid email address.')
    if len(value)>254: raise APIError('auth/invalid-email','Enter a valid email address.')
    return value

def throttle(request, action, email=''):
    retry=consume(request,action,email)
    if retry:
        raise APIError('auth/rate-limited','Too many attempts. Wait before trying again.',429)

def user_info(user):
    if not user.is_authenticated: return None
    return {'uid':str(user.pk),'email':user.email,'displayName':user.display_name,'emailVerified':bool(user.email_verified_at),
        'isAdmin':bool(user.is_active and (user.is_staff or user.is_superuser))}

def touch(user):
    User.objects.filter(pk=user.pk).update(last_active=timezone.now())

@endpoint(['GET'])
def session(request):
    if request.user.is_authenticated and not confirmations.session_is_confirmed(request): logout(request)
    if request.user.is_authenticated: touch(request.user)
    return JsonResponse({'user':user_info(request.user),'csrfToken':get_token(request)})

@endpoint(['POST'])
def signup(request):
    data=payload(request);email=email_value(data.get('email'));throttle(request,'signup',email)
    if data.get('trackingConsent') is not True: raise APIError('auth/consent-required','Agree to account progress storage and owner progress monitoring to sign up.')
    password=data.get('password')
    if not isinstance(password,str) or len(password)>256: raise APIError('auth/invalid-password','Enter a supported password.')
    name=data.get('displayName','');text(name,80,'Display name')
    candidate=User(email=email,display_name=name.strip());validate_password(password,candidate)
    logout(request)
    confirmations.require_email(email)
    try:
        with transaction.atomic():
            user=User.objects.create_user(email,password,display_name=name.strip(),tracking_consent_at=timezone.now(),tracking_consent_version='progress-v1')
            Progress.objects.create(user=user)
            challenge=confirmations.issue(user,'signup',password)
    except IntegrityError: raise APIError('auth/signup-unavailable','This account could not be created. Try signing in or requesting a password reset.')
    return JsonResponse(confirmations.challenge_body(challenge),status=202)

@endpoint(['POST'])
def signin(request):
    data=payload(request);email=email_value(data.get('email'));throttle(request,'login',email)
    password=data.get('password')
    if not isinstance(password,str) or len(password)>256: raise APIError('auth/invalid-credentials','The email or password could not be verified.',401)
    user=authenticate(request,email=email,password=password)
    if not user: raise APIError('auth/invalid-credentials','The email or password could not be verified.',401)
    logout(request)
    challenge=confirmations.issue(user,'login',password)
    return JsonResponse(confirmations.challenge_body(challenge),status=202)

@endpoint(['POST'])
def confirm_email(request):
    data=payload(request);throttle(request,'confirm-email')
    try: user=confirmations.confirm(data.get('challengeId'),data.get('token'))
    except (User.DoesNotExist,confirmations.EmailChallenge.DoesNotExist):
        raise APIError('auth/invalid-confirmation','This confirmation link is invalid or has already been used.')
    login(request,user,backend='django.contrib.auth.backends.ModelBackend')
    request.session['email_confirmed_uid']=str(user.pk)
    request.session['email_confirmed_email']=user.email
    return JsonResponse({'user':user_info(user),'csrfToken':get_token(request)})

@endpoint(['POST'])
def resend_confirmation(request):
    data=payload(request);throttle(request,'resend-confirmation')
    try: challenge=confirmations.resend(data.get('challengeId'))
    except (User.DoesNotExist,confirmations.EmailChallenge.DoesNotExist):
        raise APIError('auth/invalid-confirmation','This confirmation request is no longer available. Sign in again.')
    return JsonResponse(confirmations.challenge_body(challenge),status=202)

@endpoint(['POST'])
def signout(request):
    logout(request)
    return JsonResponse({'user':None,'csrfToken':get_token(request)})

@endpoint(['POST'])
def password_reset(request):
    data=payload(request);email=email_value(data.get('email'));throttle(request,'reset',email)
    confirmations.require_email(email)
    user=User.objects.filter(email=email,is_active=True).first()
    if user and user.has_usable_password():
        uid=urlsafe_base64_encode(force_bytes(str(user.pk)));token=default_token_generator.make_token(user)
        link=settings.PUBLIC_APP_URL+'/#reset-confirm?'+urlencode({'uid':uid,'token':token})
        try:
            accepted=send_mail('Reset your FORM password','A password reset was requested for your FORM account.\n\n'+link+'\n\nThis link expires in one hour. Ignore this message if you did not request it.',settings.DEFAULT_FROM_EMAIL,[email],fail_silently=False)
            if accepted != 1: raise RuntimeError('Email transport did not accept the message.')
        except Exception:
            # Keep the response identical for unknown addresses and transport
            # failures; log no recipient, token, password or provider exception.
            logger.error('Password reset email delivery failed.')
    return JsonResponse({'requested':True,'message':'If this address has an eligible account, a reset email will arrive.'},status=202)

@endpoint(['POST'])
def password_reset_confirm(request):
    data=payload(request);throttle(request,'reset-confirm')
    try:
        uid=force_str(urlsafe_base64_decode(data.get('uid','')))
        user=User.objects.get(pk=uid,is_active=True)
    except (ValueError,TypeError,UnicodeDecodeError,ValidationError,User.DoesNotExist):
        raise APIError('auth/invalid-reset','The reset link is invalid or expired.')
    token=data.get('token')
    if not isinstance(token,str) or not default_token_generator.check_token(user,token): raise APIError('auth/invalid-reset','The reset link is invalid or expired.')
    password=data.get('password')
    if not isinstance(password,str) or len(password)>256: raise APIError('auth/invalid-password','Enter a supported password.')
    validate_password(password,user)
    with transaction.atomic():
        locked=User.objects.select_for_update().get(pk=user.pk)
        if not default_token_generator.check_token(locked,token): raise APIError('auth/invalid-reset','The reset link is invalid or expired.')
        locked.set_password(password);locked.save(update_fields=['password'])
    return JsonResponse({'reset':True})

@endpoint(['POST'],authenticated=True)
def delete_account(request):
    data=payload(request);throttle(request,'delete-account',request.user.email)
    password=data.get('password')
    if not isinstance(password,str) or not request.user.check_password(password): raise APIError('auth/invalid-credentials','Verify your password before deleting this account.',401)
    with transaction.atomic():
        user=User.objects.select_for_update().get(pk=request.user.pk)
        if not user.check_password(password): raise APIError('auth/invalid-credentials','Verify your password before deleting this account.',401)
        user.delete()
    logout(request)
    return JsonResponse({'deleted':True,'user':None,'csrfToken':get_token(request)})

def progress_body(row):
    return {'state':row.state,'revision':row.revision,'updatedAt':row.updated_at.isoformat()}

@endpoint(['GET','PUT','DELETE'],authenticated=True,account_bound=True)
def progress(request):
    if request.method=='GET':
        touch(request.user);row=Progress.objects.filter(user=request.user).first()
        return JsonResponse(progress_body(row) if row and (row.state is not None or row.revision>0) else None,safe=False)
    data=payload(request)
    base=data.get('baseRevision')
    if request.method=='PUT' or base is not None: number(base,0,2**53-1,'Base revision',integer=True)
    state=None
    if request.method=='PUT':
        try: state=validate_state(data.get('state'))
        except (TypeError,ValueError,KeyError,RecursionError): raise APIError('progress/invalid-state','The progress state contains invalid values.')
    with transaction.atomic():
        # Serialize on the already-existing account even for the first save.
        # This closes the simultaneous initial get_or_create uniqueness race.
        user=User.objects.select_for_update().get(pk=request.user.pk)
        row,_=Progress.objects.get_or_create(user=user)
        row=Progress.objects.select_for_update().get(user=user)
        if base is not None and row.revision!=base:
            return failure('progress/conflict','Progress changed in another session. Review both versions before saving.',409,{'currentRevision':row.revision,'expectedRevision':base})
        row.state=state;row.revision+=1;row.save(update_fields=['state','revision','updated_at'])
        user.last_active=timezone.now();user.save(update_fields=['last_active'])
    return JsonResponse(progress_body(row))

def summary(user):
    try: row=user.progress;state=row.state or {}
    except Progress.DoesNotExist: state={}
    workouts=state.get('workouts',[]);walks=state.get('walks',[]);profile=state.get('profile',{})
    complete=[w for w in workouts if w.get('seconds',0)>0 and w.get('skipped',0)==0]
    minutes=sum(w.get('seconds',0) for w in workouts)/60+sum(w.get('minutes',0) for w in walks)
    activity={w['date'] for w in workouts if w.get('seconds',0)>0}|{w['date'] for w in walks if w.get('minutes',0)>0}
    current=date.today();streak=0
    if current.isoformat() not in activity: current-=timedelta(days=1)
    while current.isoformat() in activity:
        streak+=1;current-=timedelta(days=1)
    return {'uid':str(user.pk),'email':user.email,'displayName':user.display_name,'createdAt':user.date_joined.isoformat(),
        'lastActive':user.last_active.isoformat(),'completedWorkouts':len(complete),'totalMinutes':round(minutes,2),'streak':streak,
        'goalType':profile.get('goalType'),'planStart':profile.get('startDate'),'planDeadline':profile.get('deadline')}

@endpoint(['GET'],authenticated=True,owner=True,account_bound=True)
def owner_users(request):
    try: size=int(request.GET.get('pageSize','25'))
    except ValueError: raise APIError('owner/invalid-page','Use a page size from 1 to 100.')
    if not 1<=size<=100: raise APIError('owner/invalid-page','Use a page size from 1 to 100.')
    search=request.GET.get('search','').strip()
    if len(search)>120: raise APIError('owner/invalid-search','Use a shorter search term.')
    users=User.objects.filter(is_active=True).select_related('progress').order_by('date_joined','id')
    if search: users=users.filter(Q(email__icontains=search)|Q(display_name__icontains=search))
    total=users.count();cursor=request.GET.get('cursor')
    if cursor:
        try:
            if len(cursor)>1000: raise ValueError()
            previous=signing.loads(cursor,salt='owner-users',max_age=86400)
            users=users.filter(Q(date_joined__gt=previous['joined'])|Q(date_joined=previous['joined'],id__gt=previous['uid']))
        except (signing.BadSignature,ValueError,KeyError,ValidationError): raise APIError('owner/invalid-cursor','Refresh the user list to continue.')
    page=list(users[:size+1]);more=len(page)>size;page=page[:size]
    next_cursor=signing.dumps({'joined':page[-1].date_joined.isoformat(),'uid':str(page[-1].pk)},salt='owner-users',compress=True) if more and page else None
    return JsonResponse({'users':[summary(user) for user in page],'nextCursor':next_cursor,'total':total})

@endpoint(['GET'],authenticated=True,owner=True,account_bound=True)
def owner_progress(request,uid):
    try: user=User.objects.select_related('progress').get(pk=uid,is_active=True)
    except User.DoesNotExist: raise APIError('owner/not-found','This user is unavailable.',404)
    try: row=user.progress;state=row.state or {}
    except Progress.DoesNotExist: row=None;state={}
    source=state.get('profile',{})
    allowed={'goalType','startDate','deadline','experience','days','sessionMinutes','focusAreas','baselineValue','targetValue','targetUnit'}
    if source.get('goalType')=='weight': allowed-={'baselineValue','targetValue','targetUnit'}
    profile={key:source[key] for key in allowed if key in source}
    def project(records,fields): return [{key:item[key] for key in fields if key in item} for item in records]
    assessments=[x for x in state.get('assessments',[]) if x.get('unit')!='kg' and x.get('goalType')!='weight']
    workouts=project(state.get('workouts',[]),{'id','date','session','title','goalType','seconds','skipped','routineId','programId','difficultyFeedback','kcal','kcalSource'})
    for item in workouts:
        if item.get('routineId')=='pelvic-floor':
            item['title']='Private wellness session'
            # Device UUID fallbacks may use a revealing routine-name prefix.
            # Keep a stable opaque owner identifier without exposing that ID.
            item['id']='session-'+hmac.new(settings.SECRET_KEY.encode(),
                ('owner-wellness:'+str(user.pk)+':'+item['id']).encode(),hashlib.sha256).hexdigest()[:32]
            for field in ['routineId','programId','difficultyFeedback','kcal','kcalSource']:
                item.pop(field,None)
    return JsonResponse({'user':summary(user),'summary':summary(user),'profile':profile,
        'workouts':workouts,
        'walks':project(state.get('walks',[]),{'id','date','minutes','intensity'}),
        'assessments':project(assessments,{'date','value','goalType','unit','time'}),
        'revision':row.revision if row else 0,'updatedAt':row.updated_at.isoformat() if row else None})

@endpoint(['GET'])
def health(request):
    try:
        with connection.cursor() as cursor: cursor.execute('SELECT 1');cursor.fetchone()
    except Exception: return JsonResponse({'status':'unavailable'},status=503)
    return JsonResponse({'status':'ok','database':'ok'})

def pwa_index(request):
    return FileResponse((settings.REPO_DIR/'dist'/'index.html').open('rb'),content_type='text/html')

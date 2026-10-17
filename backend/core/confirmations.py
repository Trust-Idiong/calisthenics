"""Password-gated, single-use email challenges. Raw tokens are never persisted."""
import hashlib
import hmac
import logging
import re
import secrets
import uuid
from datetime import timedelta
from urllib.parse import urlencode
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from .errors import APIError
from .models import EmailChallenge, User

logger = logging.getLogger(__name__)
TTL = timedelta(minutes=15)
RESEND_SECONDS = 60
MAX_SENDS = 5
MAX_ATTEMPTS = 8

def require_email():
    configured = bool(settings.DEFAULT_FROM_EMAIL and settings.PUBLIC_APP_URL)
    if settings.EMAIL_BACKEND == 'core.email_backend.BrevoEmailBackend':
        configured = configured and bool(settings.BREVO_API_KEY and settings.BREVO_SENDER_EMAIL)
    if not configured:
        raise APIError('auth/email-unavailable','Account email confirmation is not configured by the app owner.',503)

def token_digest(token):
    return hmac.new(settings.SECRET_KEY.encode(),('form-email-confirmation:'+token).encode(),hashlib.sha256).hexdigest()

def challenge_body(challenge):
    local,domain=challenge.email.rsplit('@',1)
    return {'confirmationRequired':True,'challengeId':str(challenge.pk),
        'maskedEmail':local[:1]+'***@'+domain,'expiresAt':challenge.expires_at.isoformat(),
        'resendAfter':max(0,RESEND_SECONDS-int((timezone.now()-challenge.last_sent_at).total_seconds()))}

def deliver(challenge,token):
    action='finish creating your account' if challenge.purpose=='signup' else 'confirm this sign-in'
    subject='Confirm your FORM account' if challenge.purpose=='signup' else 'Confirm your FORM sign-in'
    link=settings.PUBLIC_APP_URL+'/#confirm-email?'+urlencode({'challenge':str(challenge.pk),'token':token})
    body=(f'Use this link to {action}:\n\n{link}\n\n'
        'Open the link and choose Confirm sign-in. It expires in 15 minutes and works once. '
        'If you did not request this, do not open or share the link. No sign-in occurs until you confirm.')
    try:
        delivered=send_mail(subject,body,settings.DEFAULT_FROM_EMAIL,[challenge.email],fail_silently=False)
        if delivered != 1: raise RuntimeError('Email transport did not accept the message.')
    except Exception:
        # Never log the provider exception, recipient, link or token.
        logger.error('Account confirmation email delivery failed.')
        raise APIError('auth/email-unavailable','The confirmation email could not be sent. Try again later or contact the app owner.',503)

def issue(user,purpose,password):
    require_email()
    raw=secrets.token_urlsafe(32)
    with transaction.atomic():
        locked=User.objects.select_for_update().get(pk=user.pk)
        now=timezone.now()
        if not locked.is_active or not locked.check_password(password):
            raise APIError('auth/invalid-credentials','The email or password could not be verified.',401)
        # One outstanding link per account. The same locking order is used by
        # issue, resend and confirm to serialize requests on PostgreSQL.
        EmailChallenge.objects.filter(user=locked,consumed_at__isnull=True).update(consumed_at=now)
        challenge=EmailChallenge.objects.create(user=locked,purpose=purpose,email=locked.email,
            token_digest=token_digest(raw),credential_digest=locked.get_session_auth_hash(),
            expires_at=now+TTL,last_sent_at=now)
        deliver(challenge,raw)
    return challenge

def challenge_user(challenge_id):
    try:
        parsed=uuid.UUID(str(challenge_id))
        return EmailChallenge.objects.only('user_id').get(pk=parsed)
    except (ValueError,TypeError,AttributeError,EmailChallenge.DoesNotExist):
        raise APIError('auth/invalid-confirmation','This confirmation link is invalid or has already been used.')

def invalid_challenge(challenge,user,now):
    if challenge.consumed_at or not user.is_active or challenge.email!=user.email or not secrets.compare_digest(challenge.credential_digest,user.get_session_auth_hash()):
        return APIError('auth/invalid-confirmation','This confirmation link is invalid or has already been used.')
    if challenge.expires_at<=now:
        return APIError('auth/confirmation-expired','This confirmation link expired. Sign in again to request a new email.')
    return None

def confirm(challenge_id,token):
    candidate=challenge_user(challenge_id);error=None
    # Even malformed tokens use a digest comparison; only bounded input is
    # accepted and every incorrect attempt is counted durably.
    valid_shape=isinstance(token,str) and bool(re.fullmatch(r'[A-Za-z0-9_-]{43}',token))
    supplied_digest=token_digest(token if valid_shape else '')
    with transaction.atomic():
        user=User.objects.select_for_update().get(pk=candidate.user_id)
        challenge=EmailChallenge.objects.select_for_update().get(pk=candidate.pk)
        now=timezone.now()
        error=invalid_challenge(challenge,user,now)
        if not error and (not valid_shape or not secrets.compare_digest(challenge.token_digest,supplied_digest)):
            challenge.failed_attempts+=1
            if challenge.failed_attempts>=MAX_ATTEMPTS: challenge.consumed_at=now
            challenge.save(update_fields=['failed_attempts','consumed_at'])
            error=APIError('auth/invalid-confirmation','This confirmation link is invalid or has already been used.')
        if not error:
            challenge.consumed_at=now;challenge.save(update_fields=['consumed_at'])
            user.email_verified_at=now;user.last_active=now
            user.save(update_fields=['email_verified_at','last_active'])
    # Raise after the transaction commits so failed-attempt counters persist.
    if error: raise error
    return user

def resend(challenge_id):
    require_email();candidate=challenge_user(challenge_id)
    with transaction.atomic():
        user=User.objects.select_for_update().get(pk=candidate.user_id)
        challenge=EmailChallenge.objects.select_for_update().get(pk=candidate.pk)
        now=timezone.now()
        error=invalid_challenge(challenge,user,now)
        if error: raise error
        wait=RESEND_SECONDS-int((now-challenge.last_sent_at).total_seconds())
        if wait>0:
            raise APIError('auth/rate-limited','Wait before requesting another confirmation email.',429,{'resendAfter':wait})
        if challenge.send_count>=MAX_SENDS:
            raise APIError('auth/rate-limited','This confirmation request reached its resend limit. Sign in again later.',429)
        raw=secrets.token_urlsafe(32)
        challenge.token_digest=token_digest(raw);challenge.last_sent_at=now
        challenge.expires_at=now+TTL;challenge.failed_attempts=0;challenge.send_count+=1
        challenge.save(update_fields=['token_digest','last_sent_at','expires_at','failed_attempts','send_count'])
        deliver(challenge,raw)
    return challenge

def session_is_confirmed(request):
    user=request.user
    return bool(user.is_authenticated and user.is_active and user.email_verified_at and
        request.session.get('email_confirmed_uid')==str(user.pk) and
        request.session.get('email_confirmed_email')==user.email)

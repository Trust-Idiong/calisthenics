import hashlib
import hmac
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .models import ThrottleBucket

def consume(request, action, email=''):
    ip = request.META.get('REMOTE_ADDR', 'unknown')
    if settings.TRUST_PROXY_IP:
        ip = request.META.get('HTTP_X_FORWARDED_FOR', ip).split(',')[-1].strip()
    identities = [(action + ':ip:' + ip, settings.AUTH_THROTTLE_LIMIT * 5),
        (action + ':email:' + email.lower(), settings.AUTH_THROTTLE_LIMIT)] if email else [(action + ':ip:' + ip, settings.AUTH_THROTTLE_LIMIT)]
    now = timezone.now()
    retry_after = 0
    for identity, limit in identities:
        key = hmac.new(settings.SECRET_KEY.encode(), identity.encode(), hashlib.sha256).hexdigest()
        with transaction.atomic():
            ThrottleBucket.objects.get_or_create(key=key)
            bucket = ThrottleBucket.objects.select_for_update().get(pk=key)
            if now - bucket.window_start >= timedelta(seconds=settings.AUTH_THROTTLE_WINDOW):
                bucket.window_start = now
                bucket.attempts = 0
            bucket.attempts += 1
            bucket.save(update_fields=['window_start', 'attempts'])
            if bucket.attempts > limit:
                retry_after = max(retry_after, max(1, settings.AUTH_THROTTLE_WINDOW - int((now - bucket.window_start).total_seconds())))
    return retry_after

import os
os.environ['DJANGO_DEBUG'] = 'true'
os.environ['ALLOW_SQLITE'] = 'true'
os.environ.pop('API_ORIGINS', None)
os.environ.pop('DATABASE_URL', None)
os.environ.setdefault('DJANGO_SECRET_KEY', 'tests-only-not-a-deployed-secret')
from .settings import *
DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
ALLOWED_HOSTS = ['testserver', 'localhost', '127.0.0.1']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
EMAIL_HOST = 'test-mail-provider'
DEFAULT_FROM_EMAIL = 'test@example.test'
PUBLIC_APP_URL = 'https://form.example.test'
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
AUTH_THROTTLE_LIMIT = 1000

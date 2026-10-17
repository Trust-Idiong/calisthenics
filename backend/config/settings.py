import os
import hashlib
from pathlib import Path
import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BASE_DIR.parent
DEBUG = os.environ.get('DJANGO_DEBUG', 'false').lower() == 'true'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise ImproperlyConfigured('DJANGO_SECRET_KEY is required outside explicit local development.')
    SECRET_KEY = 'development-only-key-never-use-in-production'
if not DEBUG:
    if len(SECRET_KEY) < 40 or len(set(SECRET_KEY)) < 10:
        raise ImproperlyConfigured('Use a randomly generated DJANGO_SECRET_KEY of at least 40 characters.')
    # Render generates a 256-bit base64 secret (44 chars). Derive a stable
    # full-length framework key without weakening that original entropy.
    SECRET_KEY = hashlib.sha512(('form-calisthenics:' + SECRET_KEY).encode()).hexdigest()
ALLOWED_HOSTS = [v.strip() for v in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1,[::1]' if DEBUG else '').split(',') if v.strip()]
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])
API_ORIGINS = [v.strip() for v in os.environ.get('API_ORIGINS', '').split(',') if v.strip()]
CSRF_TRUSTED_ORIGINS = list(API_ORIGINS)
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    CSRF_TRUSTED_ORIGINS.append('https://' + os.environ['RENDER_EXTERNAL_HOSTNAME'])
CORS_ALLOWED_ORIGINS = list(API_ORIGINS)
CORS_ALLOW_HEADERS = (*default_headers, 'x-form-user')
CORS_ALLOW_CREDENTIALS = bool(API_ORIGINS)
CORS_URLS_REGEX = r'^/api/.*$'
INSTALLED_APPS = [
    'core.admin_site.ConfirmedAdminConfig', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'corsheaders', 'core.apps.CoreConfig',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware', 'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware', 'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware', 'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware', 'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.APIHeadersMiddleware',
]
ROOT_URLCONF = 'config.urls'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
    'OPTIONS': {'context_processors': ['django.template.context_processors.request', 'django.contrib.auth.context_processors.auth', 'django.contrib.messages.context_processors.messages']}}]
WSGI_APPLICATION = 'config.wsgi.application'
AUTH_USER_MODEL = 'core.User'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
database_url = os.environ.get('DATABASE_URL', '')
if database_url:
    DATABASES = {'default': dj_database_url.parse(database_url, conn_max_age=60, conn_health_checks=True,
        ssl_require=os.environ.get('DATABASE_SSL_REQUIRE', 'true').lower() == 'true')}
    if not DEBUG and DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
        raise ImproperlyConfigured('Production requires PostgreSQL DATABASE_URL.')
elif DEBUG and os.environ.get('ALLOW_SQLITE', 'false').lower() == 'true':
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'development.sqlite3'}}
else:
    raise ImproperlyConfigured('Provide PostgreSQL DATABASE_URL; local SQLite requires DJANGO_DEBUG=true and ALLOW_SQLITE=true.')
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SAMESITE = 'None' if API_ORIGINS else 'Lax'
CSRF_COOKIE_SAMESITE = 'None' if API_ORIGINS else 'Lax'
if API_ORIGINS and DEBUG:
    raise ImproperlyConfigured('Cross-origin cookie auth requires HTTPS production settings; use same-origin local development.')
SESSION_COOKIE_AGE = 60 * 60 * 24 * 14
SESSION_SAVE_EVERY_REQUEST = False
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
X_FRAME_OPTIONS = 'DENY'
DATA_UPLOAD_MAX_MEMORY_SIZE = 8 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 1024
CSRF_FAILURE_VIEW = 'core.views.csrf_failure'
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
WHITENOISE_ROOT = REPO_DIR / 'dist'
WHITENOISE_MAX_AGE = 60
WHITENOISE_INDEX_FILE = True
STORAGES = {'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'}}
EMAIL_BACKEND = 'core.email_backend.BrevoEmailBackend'
BREVO_API_KEY = os.environ.get('BREVO_API_KEY', '')
BREVO_SENDER_EMAIL = os.environ.get('BREVO_SENDER_EMAIL', '')
BREVO_SENDER_NAME = os.environ.get('BREVO_SENDER_NAME', 'FORM')
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = BREVO_SENDER_EMAIL
PUBLIC_APP_URL = os.environ.get('PUBLIC_APP_URL',
    'https://' + os.environ['RENDER_EXTERNAL_HOSTNAME'] if os.environ.get('RENDER_EXTERNAL_HOSTNAME') else '').rstrip('/')
PASSWORD_RESET_TIMEOUT = 3600
# Shared database rate limits work across workers; no browser-supplied role/IP.
AUTH_THROTTLE_LIMIT = int(os.environ.get('AUTH_THROTTLE_LIMIT', '12'))
AUTH_THROTTLE_WINDOW = 900
TRUST_PROXY_IP = os.environ.get('TRUST_PROXY_IP', 'false').lower() == 'true'

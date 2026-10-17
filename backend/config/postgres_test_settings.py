"""Explicit integration test settings. Never point this at the production DB."""
import os
import dj_database_url
test_database_url = os.environ.get('TEST_DATABASE_URL', '')
if not test_database_url.startswith(('postgresql://', 'postgres://')):
    raise RuntimeError('TEST_DATABASE_URL must identify a disposable PostgreSQL test database.')
from .test_settings import *
DATABASES = {'default': dj_database_url.parse(test_database_url, conn_max_age=0,
    ssl_require=os.environ.get('TEST_DATABASE_SSL_REQUIRE', 'false').lower() == 'true')}

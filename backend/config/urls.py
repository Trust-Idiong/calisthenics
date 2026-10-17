from django.contrib import admin
from django.urls import include, path
from core.views import pwa_index

urlpatterns = [path('admin/', admin.site.urls), path('api/', include('core.urls')), path('', pwa_index)]

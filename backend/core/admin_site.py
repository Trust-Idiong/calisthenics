from django.contrib.admin import AdminSite
from django.contrib.admin.apps import AdminConfig
from django.contrib.auth import logout
from django.http import HttpResponseRedirect

class ConfirmedAdminSite(AdminSite):
    site_header = 'FORM account administration'
    def has_permission(self,request):
        from .confirmations import session_is_confirmed
        return super().has_permission(request) and session_is_confirmed(request)

    def login(self,request,extra_context=None):
        if self.has_permission(request):
            return HttpResponseRedirect('/admin/')
        # No independent password-only login form: owners authenticate through
        # the same mandatory email confirmation as every other account.
        if request.user.is_authenticated: logout(request)
        return HttpResponseRedirect('/#login')

class ConfirmedAdminConfig(AdminConfig):
    default_site = 'core.admin_site.ConfirmedAdminSite'

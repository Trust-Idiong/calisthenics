from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class AccountAdmin(UserAdmin):
    model = User
    ordering = ('email',)
    list_display = ('email', 'display_name', 'email_verified_at', 'last_active', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_active')
    search_fields = ('email', 'display_name')
    fieldsets = ((None, {'fields': ('email', 'password', 'display_name')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Account metadata', {'fields': ('date_joined', 'last_login', 'last_active', 'email_verified_at', 'tracking_consent_at', 'tracking_consent_version')}))
    readonly_fields = ('date_joined', 'last_login', 'last_active', 'email_verified_at', 'tracking_consent_at', 'tracking_consent_version')
    add_fieldsets = ((None, {'classes': ('wide',), 'fields': ('email', 'display_name', 'password1', 'password2', 'is_staff', 'is_active')}),)
    def save_model(self,request,obj,form,change):
        if change and 'email' in form.changed_data: obj.email_verified_at=None
        super().save_model(request,obj,form,change)
# Private progress JSON is not registered in Django admin. The owner REST view
# presents only the agreed, explicitly sanitized progress information.

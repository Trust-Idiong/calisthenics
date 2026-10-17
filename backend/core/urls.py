from django.urls import path
from . import views
urlpatterns = [
    path('health/',views.health), path('auth/session/',views.session),
    path('auth/signup/',views.signup), path('auth/login/',views.signin), path('auth/logout/',views.signout),
    path('auth/confirm-email/',views.confirm_email), path('auth/resend-confirmation/',views.resend_confirmation),
    path('auth/password-reset/',views.password_reset), path('auth/password-reset-confirm/',views.password_reset_confirm),
    path('auth/delete-account/',views.delete_account), path('progress/',views.progress),
    path('owner/users/',views.owner_users), path('owner/users/<uuid:uid>/progress/',views.owner_progress),
]

from django.urls import path

from .views import account, change_password, csrf_token, login, logout, register


urlpatterns = [
    path("auth/csrf/", csrf_token, name="auth-csrf"),
    path("auth/register/", register, name="auth-register"),
    path("auth/login/", login, name="auth-login"),
    path("auth/logout/", logout, name="auth-logout"),
    path("auth/me/", account, name="auth-me"),
    path("auth/password/", change_password, name="auth-password"),
]

from django.urls import path

from .views import (
    HealthCheck,
    UserList,
    CurrentUser,
    LogoutView
) 

urlpatterns = [

    path("health/", HealthCheck.as_view()),

    path("", UserList.as_view()),

    path("me/", CurrentUser.as_view()),

    path("logout/", LogoutView.as_view()),



]
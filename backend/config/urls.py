from django.contrib import admin
from django.urls import include, path

from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
urlpatterns = [

    path("admin/", admin.site.urls),

    path("api/users/", include("apps.users.urls")),

    path(
        "api/login/",
        TokenObtainPairView.as_view()
    ),

    path(
        "api/refresh/",
        TokenRefreshView.as_view()
    ),





    path(
        "api/projects/",
        include("apps.projects.urls")
    ),

    path("api/", include("apps.reports.urls")),

]

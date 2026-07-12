from django.urls import path

from .views import (
    HealthCheck,
    UserList,
)

urlpatterns = [

    path(
        "health/",
        HealthCheck.as_view()
    ),

    path(
        "",
        UserList.as_view()
    ),

]
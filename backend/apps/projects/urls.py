from django.urls import path
from . import views

urlpatterns = [
    path(
        "",
        views.ProjectListCreateView.as_view()
    ),

    path(
        "<int:pk>/",
        views.project_detail
    ),
]
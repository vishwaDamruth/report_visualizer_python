from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    class Roles(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        ADMIN = "ADMIN", "Admin"
        USER = "USER", "User"

    role = models.CharField(
        max_length=20,
        choices=Roles.choices,
        default=Roles.USER
    )

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username
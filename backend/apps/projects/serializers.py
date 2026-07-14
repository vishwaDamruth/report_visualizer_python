from rest_framework import serializers
from .models import Project


class ProjectSerializer(serializers.ModelSerializer):

    created_by = serializers.ReadOnlyField(
        source="created_by.username"
    )


    class Meta:

        model = Project

        fields = [
            "id",
            "name",
            "description",
            "created_by",
            "created_at",
            "updated_at",
        ]
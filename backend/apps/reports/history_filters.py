from rest_framework import serializers

from .models import ReportRun


class ReportRunHistoryFilterSerializer(serializers.Serializer):
    framework = serializers.ChoiceField(
        choices=ReportRun.Framework.values,
        required=False,
    )
    status = serializers.ChoiceField(
        choices=ReportRun.Status.values,
        required=False,
    )
    uploaded_date_from = serializers.DateField(required=False)
    uploaded_date_to = serializers.DateField(required=False)
    filename = serializers.CharField(
        required=False,
        allow_blank=False,
        max_length=255,
        trim_whitespace=True,
    )

    def validate(self, attrs):
        if "filename" in self.initial_data and not self.initial_data.get("filename", "").strip():
            raise serializers.ValidationError({
                "filename": "This field may not be blank.",
            })

        uploaded_from = attrs.get("uploaded_date_from")
        uploaded_to = attrs.get("uploaded_date_to")
        if uploaded_from and uploaded_to and uploaded_from > uploaded_to:
            raise serializers.ValidationError({
                "uploaded_date_to": (
                    "Must be on or after uploaded_date_from."
                ),
            })
        return attrs

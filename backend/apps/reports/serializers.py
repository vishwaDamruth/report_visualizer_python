from rest_framework import serializers

from .models import ReportRun, TestExecution


class TestExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestExecution   
        fields = [
            "id", "external_id", "feature", "suite", "scenario", "status",
            "duration", "error_message", "tags", "file_path", "line_number",
            "retry_count", "started_at", "finished_at", "created_at",
        ]
        read_only_fields = fields


class ReportRunListSerializer(serializers.ModelSerializer):
    uploaded_by = serializers.ReadOnlyField(source="uploaded_by.username")

    class Meta:
        model = ReportRun
        fields = [
            "id", "framework", "status", "original_filename", "total_tests",
            "passed_tests", "failed_tests", "skipped_tests", "total_duration",
            "uploaded_by", "created_at",
        ]
        read_only_fields = fields


class ReportRunDetailSerializer(ReportRunListSerializer):
    executions = TestExecutionSerializer(many=True, read_only=True)

    class Meta(ReportRunListSerializer.Meta):
        fields = ReportRunListSerializer.Meta.fields + [
            "project", "raw_file", "parser_version", "error_message",
            "updated_at", "executions",
        ]
        read_only_fields = fields

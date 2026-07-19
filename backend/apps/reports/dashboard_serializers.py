from rest_framework import serializers


class DashboardScopeSerializer(serializers.Serializer):
    test_analytics_run_status = serializers.CharField()
    trend_time_basis = serializers.CharField()
    duration_unit = serializers.CharField()


class DashboardMetricsSerializer(serializers.Serializer):
    total_report_runs = serializers.IntegerField()
    completed_report_runs = serializers.IntegerField()
    pending_report_runs = serializers.IntegerField()
    processing_report_runs = serializers.IntegerField()
    failed_report_runs = serializers.IntegerField()
    total_tests_executed = serializers.IntegerField()
    passed_tests = serializers.IntegerField()
    failed_tests = serializers.IntegerField()
    skipped_tests = serializers.IntegerField()
    unknown_tests = serializers.IntegerField()
    overall_pass_rate = serializers.FloatField(allow_null=True)
    average_run_duration = serializers.FloatField(allow_null=True)


class LatestRunSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    framework = serializers.CharField()
    status = serializers.CharField()
    original_filename = serializers.CharField()
    total_tests = serializers.IntegerField()
    passed_tests = serializers.IntegerField()
    failed_tests = serializers.IntegerField()
    skipped_tests = serializers.IntegerField()
    unknown_tests = serializers.IntegerField()
    pass_rate = serializers.FloatField(allow_null=True)
    total_duration = serializers.FloatField()
    uploaded_by = serializers.CharField()
    created_at = serializers.DateTimeField()
    error_message = serializers.CharField()


class OutcomeDistributionSerializer(serializers.Serializer):
    passed = serializers.IntegerField()
    failed = serializers.IntegerField()
    skipped = serializers.IntegerField()
    unknown = serializers.IntegerField()


class PassRateTrendSerializer(serializers.Serializer):
    report_run_id = serializers.IntegerField()
    original_filename = serializers.CharField()
    created_at = serializers.DateTimeField()
    total_tests = serializers.IntegerField()
    passed_tests = serializers.IntegerField()
    pass_rate = serializers.FloatField(allow_null=True)


class DurationTrendSerializer(serializers.Serializer):
    report_run_id = serializers.IntegerField()
    original_filename = serializers.CharField()
    created_at = serializers.DateTimeField()
    total_duration = serializers.FloatField()


class DashboardExecutionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    report_run_id = serializers.IntegerField()
    report_run_created_at = serializers.DateTimeField()
    report_filename = serializers.CharField()
    feature = serializers.CharField()
    suite = serializers.CharField()
    scenario = serializers.CharField()
    status = serializers.CharField()
    duration = serializers.FloatField()
    error_message = serializers.CharField()
    file_path = serializers.CharField()
    line_number = serializers.IntegerField(allow_null=True)
    retry_count = serializers.IntegerField()


class ProjectDashboardSerializer(serializers.Serializer):
    project_id = serializers.IntegerField()
    scope = DashboardScopeSerializer()
    metrics = DashboardMetricsSerializer()
    latest_run = LatestRunSerializer(allow_null=True)
    outcome_distribution = OutcomeDistributionSerializer()
    pass_rate_trend = PassRateTrendSerializer(many=True)
    duration_trend = DurationTrendSerializer(many=True)
    recent_failed_executions = DashboardExecutionSerializer(many=True)
    slowest_executions = DashboardExecutionSerializer(many=True)

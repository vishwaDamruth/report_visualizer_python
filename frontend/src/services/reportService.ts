import api from "./api";

export type ReportFramework = "PLAYWRIGHT" | "CUCUMBER" | "UNKNOWN";
export type ReportProcessingStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
export type TestExecutionStatus = "PASSED" | "FAILED" | "SKIPPED" | "UNKNOWN";

export interface TestExecution {
    id: number;
    external_id: string | null;
    feature: string;
    suite: string;
    scenario: string;
    status: TestExecutionStatus;
    duration: number;
    error_message: string;
    tags: string[];
    file_path: string;
    line_number: number | null;
    retry_count: number;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
}

export interface ReportRunListItem {
    id: number;
    framework: ReportFramework;
    status: ReportProcessingStatus;
    original_filename: string;
    total_tests: number;
    passed_tests: number;
    failed_tests: number;
    skipped_tests: number;
    total_duration: number;
    uploaded_by: string;
    created_at: string;
}

export interface PaginatedReportRuns {
    count: number;
    next: string | null;
    previous: string | null;
    results: ReportRunListItem[];
}

export interface ReportRunHistoryQuery {
    page?: number;
    framework?: ReportFramework;
    status?: ReportProcessingStatus;
    uploaded_date_from?: string;
    uploaded_date_to?: string;
    filename?: string;
}

export interface ReportRun extends ReportRunListItem {
    project: number;
    raw_file: string;
    parser_version: string;
    error_message: string;
    updated_at: string;
    executions: TestExecution[];
}

export interface DashboardMetrics {
    total_report_runs: number;
    completed_report_runs: number;
    pending_report_runs: number;
    processing_report_runs: number;
    failed_report_runs: number;
    total_tests_executed: number;
    passed_tests: number;
    failed_tests: number;
    skipped_tests: number;
    unknown_tests: number;
    overall_pass_rate: number | null;
    average_run_duration: number | null;
}

export interface DashboardLatestRun extends ReportRunListItem {
    unknown_tests: number;
    pass_rate: number | null;
    error_message: string;
}

export interface DashboardExecution {
    id: number;
    report_run_id: number;
    report_run_created_at: string;
    report_filename: string;
    feature: string;
    suite: string;
    scenario: string;
    status: TestExecutionStatus;
    duration: number;
    error_message: string;
    file_path: string;
    line_number: number | null;
    retry_count: number;
}

export interface ProjectDashboardResponse {
    project_id: number;
    scope: {
        test_analytics_run_status: "COMPLETED";
        trend_time_basis: "report_run.created_at";
        duration_unit: "seconds";
    };
    metrics: DashboardMetrics;
    latest_run: DashboardLatestRun | null;
    outcome_distribution: {
        passed: number;
        failed: number;
        skipped: number;
        unknown: number;
    };
    pass_rate_trend: Array<{
        report_run_id: number;
        original_filename: string;
        created_at: string;
        total_tests: number;
        passed_tests: number;
        pass_rate: number | null;
    }>;
    duration_trend: Array<{
        report_run_id: number;
        original_filename: string;
        created_at: string;
        total_duration: number;
    }>;
    recent_failed_executions: DashboardExecution[];
    slowest_executions: DashboardExecution[];
}

export function getProjectReportRuns(
    projectId: number,
    query: ReportRunHistoryQuery = {},
) {
    return api.get<PaginatedReportRuns>(`/projects/${projectId}/reports/`, {
        params: query,
    });
}

export function getProjectDashboard(projectId: number) {
    return api.get<ProjectDashboardResponse>(`/projects/${projectId}/dashboard/`);
}

export function getReportRun(reportRunId: number) {
    return api.get<ReportRun>(`/reports/${reportRunId}/`);
}

export function deleteReportRun(reportRunId: number) {
    return api.delete<void>(`/reports/${reportRunId}/`);
}

export function uploadReport(projectId: number, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    // The browser supplies the multipart boundary when Axios sends FormData.
    return api.post<ReportRun>(
        `/projects/${projectId}/reports/upload/`,
        formData,
    );
}

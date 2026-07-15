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

export interface ReportRun extends ReportRunListItem {
    project: number;
    raw_file: string;
    parser_version: string;
    error_message: string;
    updated_at: string;
    executions: TestExecution[];
}

export function getProjectReportRuns(projectId: number) {
    return api.get<ReportRunListItem[]>(`/projects/${projectId}/reports/`);
}

export function getReportRun(reportRunId: number) {
    return api.get<ReportRun>(`/reports/${reportRunId}/`);
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

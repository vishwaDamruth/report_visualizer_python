import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import ProjectDashboard from "../components/ProjectDashboard";
import { ConfirmDialog, LoadingSkeleton, PageHeader, StatusBadge } from "../components/ui";
import {
    dangerButton,
    emptyState,
    errorState,
    field,
    pageContainer,
    pageShell,
    panel,
    primaryButton,
    secondaryButton,
    successState,
} from "../components/uiStyles";
import { getProject } from "../services/projectService";
import type { Project } from "../services/projectService";
import {
    deleteReportRun,
    getProjectReportRuns,
    uploadReport,
} from "../services/reportService";
import type {
    PaginatedReportRuns,
    ReportFramework,
    ReportProcessingStatus,
    ReportRunHistoryQuery,
    ReportRunListItem,
} from "../services/reportService";

type ApiErrorResponse = Record<string, unknown> & {
    error?: string;
    detail?: string;
};

interface ProjectLocationState {
    reportDeletionSuccess?: string;
}

function formatDuration(duration: number) {
    return `${duration.toFixed(2)} s`;
}

function formatUploadedAt(timestamp: string) {
    return new Date(timestamp).toLocaleString();
}

function apiErrorMessage(error: unknown, fallback: string) {
    if (!isAxiosError<ApiErrorResponse>(error) || !error.response?.data) {
        return fallback;
    }

    const data = error.response.data;
    if (typeof data.error === "string") return data.error;
    if (typeof data.detail === "string") return data.detail;

    const fieldErrors = Object.entries(data).flatMap(([field, messages]) => {
        const values = Array.isArray(messages) ? messages : [messages];
        return values
            .filter((message): message is string => typeof message === "string")
            .map((message) => `${field.replaceAll("_", " ")}: ${message}`);
    });
    return fieldErrors.length > 0 ? fieldErrors.join(" ") : fallback;
}

interface HistoryFilters {
    framework: ReportFramework | "";
    status: ReportProcessingStatus | "";
    uploaded_date_from: string;
    uploaded_date_to: string;
    filename: string;
}

const emptyHistoryFilters: HistoryFilters = {
    framework: "",
    status: "",
    uploaded_date_from: "",
    uploaded_date_to: "",
    filename: "",
};

export default function ProjectDetails() {

    const { id } = useParams();
    const projectId = Number(id);
    const navigate = useNavigate();
    const location = useLocation();

    const [project, setProject] =
        useState<Project>();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [reportRuns, setReportRuns] = useState<ReportRunListItem[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyResult, setHistoryResult] = useState<PaginatedReportRuns>({
        count: 0,
        next: null,
        previous: null,
        results: [],
    });
    const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(emptyHistoryFilters);
    const [filenameInput, setFilenameInput] = useState("");
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState("");
    const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
    const [deletingRunId, setDeletingRunId] = useState<number | null>(null);
    const [pendingDeleteRun, setPendingDeleteRun] = useState<ReportRunListItem | null>(null);
    const [deleteError, setDeleteError] = useState("");
    const [deleteSuccess, setDeleteSuccess] = useState(
        () => (location.state as ProjectLocationState | null)?.reportDeletionSuccess ?? "",
    );
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadReportRuns = useCallback(async () => {
        setHistoryLoading(true);
        setHistoryError("");

        try {
            const query: ReportRunHistoryQuery = {
                page: historyPage,
                framework: historyFilters.framework || undefined,
                status: historyFilters.status || undefined,
                uploaded_date_from: historyFilters.uploaded_date_from || undefined,
                uploaded_date_to: historyFilters.uploaded_date_to || undefined,
                filename: historyFilters.filename || undefined,
            };
            const response = await getProjectReportRuns(projectId, query);
            setHistoryResult(response.data);
            setReportRuns(response.data.results);
        } catch (error: unknown) {
            setHistoryError(apiErrorMessage(error, "Report history could not be loaded."));
        } finally {
            setHistoryLoading(false);
        }
    }, [historyFilters, historyPage, projectId]);

    useEffect(() => {

        async function load() {

            const res =
                await getProject(projectId);

            setProject(res.data);
        }

        load();

    }, [projectId]);

    useEffect(() => {
        // The request callback owns the asynchronous loading-state transition.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadReportRuns();
    }, [loadReportRuns]);

    function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0] ?? null;

        setSuccessMessage("");
        setErrorMessage("");

        if (file && !file.name.toLowerCase().endsWith(".json")) {
            setSelectedFile(null);
            setErrorMessage("Please select a JSON report file.");
            event.target.value = "";
            return;
        }

        setSelectedFile(file);
    }

    function updateHistoryFilter<Key extends keyof HistoryFilters>(
        key: Key,
        value: HistoryFilters[Key],
    ) {
        setHistoryFilters((filters) => ({ ...filters, [key]: value }));
        setHistoryPage(1);
    }

    function handleFilenameSearch(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        updateHistoryFilter("filename", filenameInput.trim());
    }

    function clearHistoryFilters() {
        setFilenameInput("");
        setHistoryFilters({ ...emptyHistoryFilters });
        setHistoryPage(1);
    }

    async function handleUpload() {
        if (!selectedFile) {
            setErrorMessage("Select a JSON report file before uploading.");
            return;
        }

        setUploading(true);
        setSuccessMessage("");
        setErrorMessage("");

        try {
            const response = await uploadReport(projectId, selectedFile);

            setSuccessMessage(
                `${response.data.original_filename} uploaded successfully. ` +
                `${response.data.total_tests} tests were processed.`,
            );
            setSelectedFile(null);

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }

            await loadReportRuns();
            setDashboardRefreshKey((key) => key + 1);
        } catch (error: unknown) {
            setErrorMessage(
                apiErrorMessage(error, "The report could not be uploaded. Please try again."),
            );
        } finally {
            setUploading(false);
        }
    }

    function requestDeleteRun(run: ReportRunListItem) {
        setPendingDeleteRun(run);
    }

    async function confirmDeleteRun() {
        if (!pendingDeleteRun) return;
        const run = pendingDeleteRun;

        setDeletingRunId(run.id);
        setDeleteError("");
        setDeleteSuccess("");

        try {
            await deleteReportRun(run.id);
            if (reportRuns.length === 1 && historyPage > 1) {
                setHistoryLoading(true);
                setHistoryPage((page) => page - 1);
            } else {
                await loadReportRuns();
            }
            setDashboardRefreshKey((key) => key + 1);
            setDeleteSuccess(`Report run #${run.id} was deleted successfully.`);
            setPendingDeleteRun(null);
        } catch (error: unknown) {
            setDeleteError(apiErrorMessage(error, "The report run could not be deleted."));
        } finally {
            setDeletingRunId(null);
        }
    }

    if (!project)
        return (
            <main className={pageShell}>
                <LoadingSkeleton id="project-details-loading-state" testId="project-details-loading" label="Loading project" rows={5} />
            </main>
        );

    return (

        <main className={pageShell}>

            <div id="project-details-page" data-testid="project-details" className={`${pageContainer} section-enter`}>

                <PageHeader id="project-details-header" eyebrow="Project" title={project.name} description={project.description || "Automation report analytics and run history."} />

                <ProjectDashboard
                    projectId={projectId}
                    refreshKey={dashboardRefreshKey}
                />

                <section id="report-upload-section" data-testid="report-upload" className={`${panel} mt-8 sm:mt-10`}>

                    <h2 className="text-xl font-semibold">
                        Upload Report
                    </h2>

                    <p className="mt-2 text-sm text-slate-400">
                        Select a Cucumber JSON report to process for this project.
                    </p>

                    <label
                        className="mt-6 block text-sm font-medium text-slate-200"
                        htmlFor="report-upload-input"
                    >
                        JSON report file
                    </label>

                    <input
                        ref={fileInputRef}
                        id="report-upload-input"
                        data-testid="report-upload-input"
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileChange}
                        disabled={uploading}
                        className={`${field} mt-2 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-indigo-500`}
                    />

                    <p className="mt-3 min-h-5 text-sm text-slate-300">
                        {selectedFile
                            ? `Selected file: ${selectedFile.name}`
                            : "No file selected."}
                    </p>

                    {successMessage && (
                        <div
                            role="status"
                            className={`${successState} mt-4`}
                        >
                            {successMessage}
                        </div>
                    )}

                    {errorMessage && (
                        <div
                            role="alert"
                            className={`${errorState} mt-4`}
                        >
                            {errorMessage}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                        id="report-upload-button"
                        data-testid="report-upload-button"
                        className={`${primaryButton} mt-6`}
                    >
                        {uploading ? "Uploading..." : "Upload Report"}
                    </button>

                </section>

                <section id="report-history-section" data-testid="report-history" className={`${panel} mt-8 sm:mt-10`} aria-labelledby="report-history-heading">

                    <h2 id="report-history-heading" className="text-xl font-semibold">
                        Report Run History
                    </h2>

                    <p className="mt-2 text-sm text-slate-400">
                        Uploaded automation runs for this project, newest first.
                    </p>

                    <div className="mt-6 rounded-xl border border-white/10 bg-slate-900/40 p-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <label className="text-sm text-slate-300">
                                <span className="mb-2 block">Framework</span>
                                <select
                                    id="report-framework-filter"
                                    data-testid="report-framework-filter"
                                    value={historyFilters.framework}
                                    onChange={(event) => updateHistoryFilter(
                                        "framework",
                                        event.target.value as ReportFramework | "",
                                    )}
                                    className={field}
                                >
                                    <option value="">All frameworks</option>
                                    <option value="CUCUMBER">Cucumber</option>
                                    <option value="PLAYWRIGHT">Playwright</option>
                                    <option value="UNKNOWN">Unknown</option>
                                </select>
                            </label>

                            <label className="text-sm text-slate-300">
                                <span className="mb-2 block">Processing status</span>
                                <select
                                    id="report-status-filter"
                                    data-testid="report-status-filter"
                                    value={historyFilters.status}
                                    onChange={(event) => updateHistoryFilter(
                                        "status",
                                        event.target.value as ReportProcessingStatus | "",
                                    )}
                                    className={field}
                                >
                                    <option value="">All statuses</option>
                                    <option value="PENDING">Pending</option>
                                    <option value="PROCESSING">Processing</option>
                                    <option value="COMPLETED">Completed</option>
                                    <option value="FAILED">Failed</option>
                                </select>
                            </label>

                            <label className="text-sm text-slate-300">
                                <span className="mb-2 block">Uploaded from</span>
                                <input
                                    id="report-uploaded-from-filter"
                                    data-testid="report-uploaded-from-filter"
                                    type="date"
                                    value={historyFilters.uploaded_date_from}
                                    onChange={(event) => updateHistoryFilter("uploaded_date_from", event.target.value)}
                                    className={field}
                                />
                            </label>

                            <label className="text-sm text-slate-300">
                                <span className="mb-2 block">Uploaded to</span>
                                <input
                                    id="report-uploaded-to-filter"
                                    data-testid="report-uploaded-to-filter"
                                    type="date"
                                    value={historyFilters.uploaded_date_to}
                                    onChange={(event) => updateHistoryFilter("uploaded_date_to", event.target.value)}
                                    className={field}
                                />
                            </label>

                            <form onSubmit={handleFilenameSearch} className="text-sm text-slate-300">
                                <label htmlFor="report-filename-filter" className="mb-2 block">Filename</label>
                                <div className="flex gap-2">
                                    <input
                                        id="report-filename-filter"
                                        data-testid="report-filename-filter"
                                        type="search"
                                        value={filenameInput}
                                        onChange={(event) => setFilenameInput(event.target.value)}
                                        placeholder="Search filename"
                                        className={`${field} min-w-0 flex-1`}
                                    />
                                    <button id="report-filter-search-button" data-testid="report-filter-search" type="submit" className={`${primaryButton} min-h-11 px-3`}>
                                        Search
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate-400">
                                {historyResult.count.toLocaleString()} result{historyResult.count === 1 ? "" : "s"}
                            </p>
                            <button
                                type="button"
                                onClick={clearHistoryFilters}
                                disabled={!Object.values(historyFilters).some(Boolean) && !filenameInput}
                                id="clear-report-filters-button"
                                data-testid="clear-report-filters"
                                className="rounded-md text-sm font-semibold text-indigo-300 hover:text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:text-slate-600"
                            >
                                Clear filters
                            </button>
                        </div>
                    </div>

                    {deleteSuccess && (
                        <div role="status" className={`${successState} mt-4`}>
                            {deleteSuccess}
                        </div>
                    )}

                    {deleteError && (
                        <div role="alert" className={`${errorState} mt-4`}>
                            {deleteError}
                        </div>
                    )}

                    {historyLoading && (
                        <div className="mt-6"><LoadingSkeleton id="report-history-loading-state" testId="report-history-loading" label="Loading report history" rows={5} /></div>
                    )}

                    {!historyLoading && historyError && (
                        <div
                            role="alert"
                            className={`${errorState} mt-6`}
                        >
                            {historyError}
                        </div>
                    )}

                    {!historyLoading && !historyError && reportRuns.length === 0 && (
                        <div className={`${emptyState} mt-6`}>
                            {Object.values(historyFilters).some(Boolean)
                                ? "No report runs match the selected filters."
                                : "No report runs have been uploaded yet."}
                        </div>
                    )}

                    {!historyLoading && !historyError && reportRuns.length > 0 && (
                        <div className="mt-6 max-w-full overflow-x-auto rounded-xl border border-white/10">
                            <table id="report-history-table" data-testid="report-history-table" className="w-full min-w-[1040px] text-left text-sm">
                                <thead className="table-header">
                                    <tr>
                                        <th className="px-4 py-3">Run ID</th>
                                        <th className="px-4 py-3">Filename</th>
                                        <th className="px-4 py-3">Framework</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 text-right">Passed</th>
                                        <th className="px-4 py-3 text-right">Failed</th>
                                        <th className="px-4 py-3 text-right">Skipped</th>
                                        <th className="px-4 py-3 text-right">Duration</th>
                                        <th className="px-4 py-3">Uploaded</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {reportRuns.map((run) => (
                                        <tr
                                            id={`report-run-row-${run.id}`}
                                            data-testid={`report-run-row-${run.id}`}
                                            key={run.id}
                                            role="link"
                                            tabIndex={0}
                                            onClick={() => navigate(`/reports/${run.id}`)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault();
                                                    navigate(`/reports/${run.id}`);
                                                }
                                            }}
                                            className="interactive-row bg-slate-900/20 text-slate-200"
                                        >
                                            <td className="px-4 py-4 font-medium">#{run.id}</td>
                                            <td className="max-w-64 truncate px-4 py-4" title={run.original_filename}>
                                                {run.original_filename}
                                            </td>
                                            <td className="px-4 py-4">{run.framework}</td>
                                            <td className="px-4 py-4">
                                                <StatusBadge status={run.status} id={`report-run-status-${run.id}`} />
                                            </td>
                                            <td className="px-4 py-4 text-right">{run.total_tests}</td>
                                            <td className="px-4 py-4 text-right text-emerald-300">{run.passed_tests}</td>
                                            <td className="px-4 py-4 text-right text-red-300">{run.failed_tests}</td>
                                            <td className="px-4 py-4 text-right text-amber-300">{run.skipped_tests}</td>
                                            <td className="px-4 py-4 text-right">{formatDuration(run.total_duration)}</td>
                                            <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                                                {formatUploadedAt(run.created_at)}
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <button
                                                    type="button"
                                                    disabled={deletingRunId !== null}
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        requestDeleteRun(run);
                                                    }}
                                                    onKeyDown={(event) => event.stopPropagation()}
                                                    id={`delete-report-button-${run.id}`}
                                                    data-testid={`delete-report-${run.id}`}
                                                    className={`${dangerButton} min-h-9 px-3 py-1.5 text-xs`}
                                                >
                                                    {deletingRunId === run.id ? "Deleting..." : "Delete"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!historyLoading && !historyError && (
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-slate-400">Page {historyPage}</p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                                    disabled={historyResult.previous === null || deletingRunId !== null}
                                    id="report-history-previous-button"
                                    data-testid="report-history-previous"
                                    className={secondaryButton}
                                >
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setHistoryPage((page) => page + 1)}
                                    disabled={historyResult.next === null || deletingRunId !== null}
                                    id="report-history-next-button"
                                    data-testid="report-history-next"
                                    className={secondaryButton}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                </section>
                <ConfirmDialog open={pendingDeleteRun !== null} id="delete-report-dialog" testId="delete-report-dialog" title="Delete report run?" description={`Report run #${pendingDeleteRun?.id ?? ""} (${pendingDeleteRun?.original_filename ?? ""}) and its test executions will be permanently deleted.`} confirmLabel="Delete report" busy={deletingRunId !== null} onCancel={() => setPendingDeleteRun(null)} onConfirm={() => void confirmDeleteRun()} />

            </div>


        </main>

    );
}

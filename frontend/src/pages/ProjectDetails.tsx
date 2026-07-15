import { useCallback, useEffect, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { getProject } from "../services/projectService";
import type { Project } from "../services/projectService";
import {
    getProjectReportRuns,
    uploadReport,
} from "../services/reportService";
import type {
    ReportProcessingStatus,
    ReportRunListItem,
} from "../services/reportService";

interface ApiErrorResponse {
    error?: string;
    detail?: string;
}

const statusStyles: Record<ReportProcessingStatus, string> = {
    PENDING: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    PROCESSING: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    COMPLETED: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    FAILED: "border-red-400/30 bg-red-500/10 text-red-200",
};

function formatDuration(duration: number) {
    return `${duration.toFixed(2)} s`;
}

function formatUploadedAt(timestamp: string) {
    return new Date(timestamp).toLocaleString();
}

export default function ProjectDetails() {

    const { id } = useParams();
    const projectId = Number(id);
    const navigate = useNavigate();

    const [project, setProject] =
        useState<Project>();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [reportRuns, setReportRuns] = useState<ReportRunListItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadReportRuns = useCallback(async () => {
        setHistoryLoading(true);
        setHistoryError("");

        try {
            const response = await getProjectReportRuns(projectId);
            setReportRuns(response.data);
        } catch (error: unknown) {
            if (isAxiosError<ApiErrorResponse>(error)) {
                setHistoryError(
                    error.response?.data?.error ??
                    error.response?.data?.detail ??
                    "Report history could not be loaded.",
                );
            } else {
                setHistoryError("Report history could not be loaded.");
            }
        } finally {
            setHistoryLoading(false);
        }
    }, [projectId]);

    useEffect(() => {

        async function load() {

            const res =
                await getProject(projectId);

            setProject(res.data);
        }

        load();

    }, [projectId]);

    useEffect(() => {
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
        } catch (error: unknown) {
            if (isAxiosError<ApiErrorResponse>(error)) {
                setErrorMessage(
                    error.response?.data?.error ??
                    "The report could not be uploaded. Please try again.",
                );
            } else {
                setErrorMessage("The report could not be uploaded. Please try again.");
            }
        } finally {
            setUploading(false);
        }
    }

    if (!project)
        return (
            <div className="min-h-screen bg-slate-950 p-8 text-white">
                Loading...
            </div>
        );

    return (

        <div className="min-h-screen bg-slate-950 p-8 text-white">

            <div className="mx-auto max-w-6xl">

                <h1 className="text-3xl font-bold">

                    {project.name}

                </h1>

                <p className="mt-4 text-slate-300">

                    {project.description}

                </p>

                <section className="mt-10 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">

                    <h2 className="text-xl font-semibold">
                        Upload Report
                    </h2>

                    <p className="mt-2 text-sm text-slate-400">
                        Select a Cucumber JSON report to process for this project.
                    </p>

                    <label
                        className="mt-6 block text-sm font-medium text-slate-200"
                        htmlFor="report-file"
                    >
                        JSON report file
                    </label>

                    <input
                        ref={fileInputRef}
                        id="report-file"
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileChange}
                        disabled={uploading}
                        className="mt-2 block w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    />

                    <p className="mt-3 min-h-5 text-sm text-slate-300">
                        {selectedFile
                            ? `Selected file: ${selectedFile.name}`
                            : "No file selected."}
                    </p>

                    {successMessage && (
                        <div
                            role="status"
                            className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
                        >
                            {successMessage}
                        </div>
                    )}

                    {errorMessage && (
                        <div
                            role="alert"
                            className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                        >
                            {errorMessage}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                        className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {uploading ? "Uploading..." : "Upload Report"}
                    </button>

                </section>

                <section className="mt-10 rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl">

                    <h2 className="text-xl font-semibold">
                        Report Run History
                    </h2>

                    <p className="mt-2 text-sm text-slate-400">
                        Uploaded automation runs for this project, newest first.
                    </p>

                    {historyLoading && (
                        <div className="mt-6 rounded-xl bg-slate-800/60 px-4 py-6 text-center text-sm text-slate-300">
                            Loading report history...
                        </div>
                    )}

                    {!historyLoading && historyError && (
                        <div
                            role="alert"
                            className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                        >
                            {historyError}
                        </div>
                    )}

                    {!historyLoading && !historyError && reportRuns.length === 0 && (
                        <div className="mt-6 rounded-xl border border-dashed border-slate-600 px-4 py-8 text-center text-sm text-slate-400">
                            No report runs have been uploaded yet.
                        </div>
                    )}

                    {!historyLoading && !historyError && reportRuns.length > 0 && (
                        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
                            <table className="w-full min-w-[980px] text-left text-sm">
                                <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {reportRuns.map((run) => (
                                        <tr
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
                                            className="cursor-pointer bg-slate-900/30 text-slate-200 transition hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                                        >
                                            <td className="px-4 py-4 font-medium">#{run.id}</td>
                                            <td className="max-w-64 truncate px-4 py-4" title={run.original_filename}>
                                                {run.original_filename}
                                            </td>
                                            <td className="px-4 py-4">{run.framework}</td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[run.status]}`}>
                                                    {run.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-right">{run.total_tests}</td>
                                            <td className="px-4 py-4 text-right text-emerald-300">{run.passed_tests}</td>
                                            <td className="px-4 py-4 text-right text-red-300">{run.failed_tests}</td>
                                            <td className="px-4 py-4 text-right text-amber-300">{run.skipped_tests}</td>
                                            <td className="px-4 py-4 text-right">{formatDuration(run.total_duration)}</td>
                                            <td className="whitespace-nowrap px-4 py-4 text-slate-400">
                                                {formatUploadedAt(run.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                </section>

            </div>


        </div>

    );
}

import { useCallback, useEffect, useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";

import {
    dangerButton,
    errorState,
    field,
    focusLink,
    pageContainer,
    pageShell,
    panel,
    primaryButton,
} from "../components/uiStyles";
import api from "../services/api";
import { deleteProject } from "../services/projectService";
import { ConfirmDialog, EmptyState, LoadingSkeleton, PageHeader } from "../components/ui";

interface Project {
    id: number;
    name: string;
    description: string;
    owner: string;
}

function Projects() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
    const [error, setError] = useState("");

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const response = await api.get<Project[]>("/projects/");
            setProjects(response.data);
        } catch {
            setError("Projects could not be loaded. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // The request callback owns the asynchronous loading-state transition.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void fetchProjects();
    }, [fetchProjects]);

    async function createProject(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setCreating(true);
        setError("");
        try {
            await api.post("/projects/", { name, description });
            setName("");
            setDescription("");
            await fetchProjects();
        } catch (requestError: unknown) {
            if (isAxiosError<{ detail?: string }>(requestError)) {
                setError(requestError.response?.data?.detail ?? "The project could not be created.");
            } else {
                setError("The project could not be created.");
            }
        } finally {
            setCreating(false);
        }
    }

    function requestDelete(event: React.MouseEvent, project: Project) {
        event.stopPropagation();
        setPendingDelete(project);
    }

    async function confirmDelete() {
        if (!pendingDelete) return;

        setDeletingId(pendingDelete.id);
        setError("");
        try {
            await deleteProject(pendingDelete.id);
            setPendingDelete(null);
            await fetchProjects();
        } catch {
            setError("The project could not be deleted.");
        } finally {
            setDeletingId(null);
        }
    }

    return (
        <main className={pageShell}>
            <div id="projects-page" data-testid="projects-page" className={`${pageContainer} section-enter`}>
                <PageHeader id="projects-page-header" eyebrow="Workspace" title="Projects" description="Create a project or open an existing one to manage automation reports." />

                {error && <div role="alert" className={`${errorState} mb-6`}>{error}</div>}

                <form id="create-project-form" data-testid="create-project-form" onSubmit={createProject} className={`${panel} mb-10 mt-8`}>
                    <h2 className="text-xl font-semibold">Create project</h2>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-medium text-slate-200" htmlFor="project-name-input">
                            Project name
                            <input id="project-name-input" data-testid="project-name" required maxLength={200} className={`${field} mt-2`} value={name} onChange={(event) => setName(event.target.value)} />
                        </label>
                        <label className="text-sm font-medium text-slate-200" htmlFor="project-description-input">
                            Description <span className="font-normal text-slate-500">(optional)</span>
                            <input id="project-description-input" data-testid="project-description" className={`${field} mt-2`} value={description} onChange={(event) => setDescription(event.target.value)} />
                        </label>
                    </div>
                    <button id="create-project-button" data-testid="create-project" type="submit" disabled={creating || !name.trim()} className={`${primaryButton} mt-5`}>
                        {creating ? "Creating..." : "Create project"}
                    </button>
                </form>

                <section aria-labelledby="project-list-heading">
                    <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <h2 id="project-list-heading" className="text-xl font-semibold">Your projects</h2>
                            {!loading && <p className="mt-1 text-sm text-slate-400">{projects.length} project{projects.length === 1 ? "" : "s"}</p>}
                        </div>
                    </div>

                    {loading ? (
                        <LoadingSkeleton id="projects-loading-state" testId="projects-loading" label="Loading projects" rows={4} />
                    ) : projects.length === 0 ? (
                        <EmptyState id="projects-empty-state" testId="projects-empty" title="No projects yet" description="Create a project above to start uploading and analyzing automation reports." />
                    ) : (
                        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {projects.map((project) => (
                                <article id={`project-card-${project.id}`} data-testid="project-card" key={project.id} className={`${panel} project-card flex min-h-52 flex-col transition duration-200 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl`}>
                                    <button
                                        type="button"
                                        onClick={() => navigate(`/projects/${project.id}`)}
                                        id={`project-card-link-${project.id}`}
                                        data-testid={`project-card-link-${project.id}`}
                                        className={`${focusLink} text-left`}
                                    >
                                        <h3 className="break-words text-xl font-semibold text-white">{project.name}</h3>
                                    </button>
                                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-300">
                                        {project.description || "No description provided."}
                                    </p>
                                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                                        <p className="text-xs text-slate-500">Created by {project.owner}</p>
                                        <button
                                            id={`delete-project-button-${project.id}`}
                                            data-testid={`delete-project-${project.id}`}
                                            type="button"
                                            onClick={(event) => requestDelete(event, project)}
                                            disabled={deletingId !== null}
                                            className={`${dangerButton} min-h-9 px-3 py-1.5 text-xs`}
                                        >
                                            {deletingId === project.id ? "Deleting..." : "Delete"}
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
                <ConfirmDialog
                    open={pendingDelete !== null}
                    id="delete-project-dialog"
                    testId="delete-project-dialog"
                    title="Delete project?"
                    description={`This will permanently delete “${pendingDelete?.name ?? "this project"}” and its reports. This action cannot be undone.`}
                    confirmLabel="Delete project"
                    busy={deletingId !== null}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={() => void confirmDelete()}
                />
            </div>
        </main>
    );
}

export default Projects;

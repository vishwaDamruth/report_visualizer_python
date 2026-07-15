import api from "./api";

export interface Project {
    id: number;
    name: string;
    description: string;
    created_at: string;
    updated_at: string;
}

export const getProjects = () => api.get<Project[]>("/projects/");

export const getProject = (id: number) =>
    api.get<Project>(`/projects/${id}/`);

export const createProject = (data: Partial<Project>) =>
    api.post("/projects/", data);

export const updateProject = (
    id: number,
    data: Partial<Project>
) => api.put(`/projects/${id}/`, data);

export const deleteProject = (id: number) =>
    api.delete(`/projects/${id}/`);
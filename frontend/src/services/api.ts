import type { Character, SceneAsset, StoryAnalysis, EpisodeOutline } from "@/types";

export const USE_MOCK = false;

const API_BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  // Project CRUD
  async createProject(file: File, name: string) {
    const form = new FormData();
    form.append("file", file);
    form.append("name", name);
    const res = await fetch(`${API_BASE}/projects`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Failed to create project");
    return res.json() as Promise<{ project_id: string; name: string }>;
  },

  async listProjects(): Promise<{ project_id: string; name: string; status: string; created_at?: string }[]> {
    return request(`/projects`);
  },

  async deleteProject(id: string): Promise<void> {
    await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" });
  },

  // Pipeline
  async runPipeline(projectId: string, settings?: Record<string, unknown>) {
    return request<{ message: string }>(`/projects/${projectId}/run`, {
      method: "POST",
      body: JSON.stringify({ settings: settings || null }),
    });
  },

  async getStatus(projectId: string) {
    return request<{
      status: string;
      name: string;
      current_step: string | null;
      progress: number;
      error: string | null;
    }>(`/projects/${projectId}/status`);
  },

  // Script (已由后端转换为前端格式)
  async getScript(projectId: string) {
    return request<Record<string, unknown>>(`/projects/${projectId}/script`);
  },

  // Novel text
  async getNovel(projectId: string): Promise<string | null> {
    try {
      const data = await request<{ text: string }>(`/projects/${projectId}/novel`);
      return data.text;
    } catch {
      return null;
    }
  },

  // Characters & Scenes
  async getCharacters(projectId: string): Promise<Character[]> {
    return request<Character[]>(`/projects/${projectId}/characters`);
  },

  async getSceneAssets(projectId: string): Promise<SceneAsset[]> {
    return request<SceneAsset[]>(`/projects/${projectId}/scenes`);
  },

  // Analysis & Outlines
  async getAnalysis(projectId: string): Promise<StoryAnalysis | null> {
    try {
      return await request<StoryAnalysis>(`/projects/${projectId}/analysis`);
    } catch {
      return null;
    }
  },

  async getOutlines(projectId: string): Promise<EpisodeOutline[]> {
    try {
      return await request<EpisodeOutline[]>(`/projects/${projectId}/outlines`);
    } catch {
      return [];
    }
  },

  // Frames
  getFrameUrl(projectId: string, episode: string, shotId: string) {
    return `${API_BASE}/projects/${projectId}/frames/${episode}/${shotId}`;
  },

  // Asset regeneration
  async regenerateCharacter(projectId: string, charId: string): Promise<{ image: string }> {
    return request(`/projects/${projectId}/characters/${charId}/regenerate`, { method: "POST" });
  },

  async regenerateScene(projectId: string, sceneId: string): Promise<{ image: string }> {
    return request(`/projects/${projectId}/scenes/${sceneId}/regenerate`, { method: "POST" });
  },

  // Candidates
  async getCandidates(projectId: string, type: string, id: string): Promise<{ candidates: string[] }> {
    return request(`/projects/${projectId}/assets/${type}/${id}/candidates`);
  },

  // Select reference image
  async selectAsset(projectId: string, type: string, id: string, image: string): Promise<{ reference_image: string }> {
    return request(`/projects/${projectId}/assets/${type}/${id}/select`, {
      method: "POST",
      body: JSON.stringify({ image }),
    });
  },
};

// 保留但不再使用，方便切回 mock
export function saveProjectLocally(_project: { project_id: string; name: string; status: string }) {
  // no-op when using real backend
}

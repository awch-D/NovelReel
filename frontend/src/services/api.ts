import type { Character, SceneAsset, PropAsset, StoryAnalysis, EpisodeOutline, LibraryVersion, VoiceProfile, DialogueLine, SystemSettings } from "@/types";

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
  // System settings
  async getSystemSettings(): Promise<SystemSettings> {
    return request<SystemSettings>("/settings");
  },

  async updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
    return request<SystemSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  // Project CRUD
  async createProject(file: File | File[], name: string) {
    const form = new FormData();
    const files = Array.isArray(file) ? file : [file];
    files.forEach((f) => form.append("file", f));
    form.append("name", name);
    const res = await fetch(`${API_BASE}/projects`, { method: "POST", body: form });
    if (!res.ok) throw new Error("Failed to create project");
    return res.json() as Promise<{ project_id: string; name: string }>;
  },

  async listProjects(): Promise<{ project_id: string; name: string; status: string; created_at?: string; cover?: string }[]> {
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

  async getFrameList(projectId: string, episode: string): Promise<{ shot_id: string; status: string; url: string | null }[]> {
    return request(`/projects/${projectId}/frames-list/${episode}`);
  },

  async regenerateFrame(projectId: string, episode: string, shotId: string): Promise<{ status: string }> {
    return request(`/projects/${projectId}/frames/${episode}/${shotId}/regenerate`, { method: "POST" });
  },

  async regenerateFrameBatch(projectId: string, episode: string, shotIds: string[]): Promise<{ status: string; count: number }> {
    return request(`/projects/${projectId}/frames/${episode}/regenerate-batch`, {
      method: "POST",
      body: JSON.stringify({ shot_ids: shotIds }),
    });
  },

  async generateEpisodeFrames(projectId: string, episode: string): Promise<{ status: string; count: number }> {
    return request(`/projects/${projectId}/frames/${episode}/generate`, { method: "POST" });
  },

  async markFrame(projectId: string, episode: string, shotId: string): Promise<{ shot_id: string; marked: boolean }> {
    return request(`/projects/${projectId}/frames/${episode}/${shotId}/mark`, { method: "PUT" });
  },

  // Asset unlock
  async unlockAsset(projectId: string, type: string, id: string): Promise<{ affected_episodes: string[]; affected_shots: number }> {
    return request(`/projects/${projectId}/assets/${type}/${id}/unlock`, { method: "POST" });
  },

  async getLockStatus(projectId: string): Promise<{ all_locked: boolean; unlocked: { type: string; id: string; name: string }[] }> {
    return request(`/projects/${projectId}/assets/lock-status`);
  },

  // Logs
  async getLogs(projectId: string): Promise<{ timestamp: string; stage: string; message: string; level: string }[]> {
    try {
      return await request(`/projects/${projectId}/logs`);
    } catch {
      return [];
    }
  },

  // Export
  getExportUrl(projectId: string) {
    return `${API_BASE}/projects/${projectId}/export`;
  },

  // Novel reorder
  async reorderNovel(projectId: string, fileOrder: string[]): Promise<{ status: string }> {
    return request(`/projects/${projectId}/novel/reorder`, {
      method: "PUT",
      body: JSON.stringify({ file_order: fileOrder }),
    });
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

  // Generate core views
  async generateCharacterCoreViews(projectId: string, charId: string): Promise<{ status: string }> {
    return request(`/projects/${projectId}/characters/${charId}/generate-core-views`, { method: "POST" });
  },

  async generateSceneCoreViews(projectId: string, sceneId: string): Promise<{ status: string }> {
    return request(`/projects/${projectId}/scenes/${sceneId}/generate-core-views`, { method: "POST" });
  },

  // Props
  async getProps(projectId: string): Promise<PropAsset[]> {
    return request<PropAsset[]>(`/projects/${projectId}/props`);
  },

  async regenerateProp(projectId: string, propId: string): Promise<{ image: string }> {
    return request(`/projects/${projectId}/props/${propId}/regenerate`, { method: "POST" });
  },

  // Upload candidate image
  async uploadCandidate(projectId: string, type: string, id: string, file: File): Promise<{ image: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/projects/${projectId}/assets/${type}/${id}/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  // Library (versioning)
  async getLibrary(projectId: string, type: string, id: string): Promise<{ versions: LibraryVersion[] }> {
    return request(`/projects/${projectId}/assets/${type}/${id}/library`);
  },

  async saveToLibrary(projectId: string, type: string, id: string): Promise<LibraryVersion> {
    return request(`/projects/${projectId}/assets/${type}/${id}/library/save`, { method: "POST" });
  },

  async activateVersion(projectId: string, type: string, id: string, version: string): Promise<{ reference_image: string }> {
    return request(`/projects/${projectId}/assets/${type}/${id}/library/${version}/activate`, { method: "POST" });
  },

  // Voice
  async getVoiceCharacters(projectId: string): Promise<VoiceProfile[]> {
    return request(`/projects/${projectId}/voice/characters`);
  },

  async updateVoiceConfig(projectId: string, charId: string, config: { language: string; prompt_text: string }): Promise<{ language: string; prompt_text: string }> {
    return request(`/projects/${projectId}/voice/characters/${charId}`, {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },

  async uploadRefAudio(projectId: string, charId: string, file: File): Promise<{ status: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/projects/${projectId}/voice/characters/${charId}/upload-ref`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  async getDialogues(projectId: string, episode: string): Promise<DialogueLine[]> {
    return request(`/projects/${projectId}/voice/dialogues/${episode}`);
  },

  async generateTTS(projectId: string, lineId: string): Promise<{ status: string; line_id: string }> {
    return request(`/projects/${projectId}/voice/dialogues/${lineId}/generate`, { method: "POST" });
  },

  async generateAllTTS(projectId: string, episode: string): Promise<{ status: string; count: number }> {
    return request(`/projects/${projectId}/voice/episodes/${episode}/generate-all`, { method: "POST" });
  },

  async mergeDialogues(projectId: string, episode: string): Promise<{ status: string; merged_shots: number }> {
    return request(`/projects/${projectId}/voice/episodes/${episode}/merge`, { method: "POST" });
  },

  async generateLipsync(projectId: string, shotId: string): Promise<{ status: string }> {
    return request(`/projects/${projectId}/voice/lipsync/${shotId}`, { method: "POST" });
  },

  async testTTS(projectId: string): Promise<{ ok: boolean; message: string }> {
    return request(`/projects/${projectId}/voice/test-tts`, { method: "POST" });
  },

  getVoiceAudioUrl(projectId: string, path: string) {
    return `${API_BASE}/projects/${projectId}/voice/audio/${path}`;
  },

  // Synthesis
  async getSynthesisStatus(projectId: string): Promise<{ episodes: { episode: string; status: string; url: string | null }[] }> {
    return request(`/projects/${projectId}/synthesis/status`);
  },

  async getSynthesisSettings(projectId: string): Promise<{ bgm: string | null; bgm_volume: number; subtitles: boolean; font_size: number }> {
    return request(`/projects/${projectId}/synthesis/settings`);
  },

  async updateSynthesisSettings(projectId: string, settings: { bgm: string | null; bgm_volume: number; subtitles: boolean; font_size: number }) {
    return request(`/projects/${projectId}/synthesis/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  },

  async assembleEpisode(projectId: string, episode: string): Promise<{ status: string }> {
    return request(`/projects/${projectId}/synthesis/episodes/${episode}/assemble`, { method: "POST" });
  },

  async assembleAll(projectId: string): Promise<{ status: string; count: number }> {
    return request(`/projects/${projectId}/synthesis/assemble-all`, { method: "POST" });
  },

  getEpisodePreviewUrl(projectId: string, episode: string) {
    return `${API_BASE}/projects/${projectId}/synthesis/episodes/${episode}/preview`;
  },

  async uploadBGM(projectId: string, file: File): Promise<{ path: string; name: string }> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API_BASE}/projects/${projectId}/synthesis/bgm/upload`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },

  async listBGM(projectId: string): Promise<{ name: string; path: string; url: string }[]> {
    return request(`/projects/${projectId}/synthesis/bgm/list`);
  },

  async listBGMPresets(projectId: string): Promise<{ name: string; category: string; path: string; url: string }[]> {
    return request(`/projects/${projectId}/synthesis/bgm/presets`);
  },
};

// 保留但不再使用，方便切回 mock
export function saveProjectLocally(_project: { project_id: string; name: string; status: string }) {
  // no-op when using real backend
}

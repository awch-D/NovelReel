import { create } from "zustand";
import type { Project, ProjectSettings, SystemSettings, Character, SceneAsset, PropAsset, StoryAnalysis, EpisodeOutline, Chapter, Episode } from "@/types";
import { DEFAULT_SETTINGS, DEFAULT_SYSTEM_SETTINGS } from "@/types";
import { api } from "@/services/api";

interface ProjectStore {
  // Project list
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  removeProject: (id: string) => void;
  updateProject: (id: string, data: Partial<Project>) => void;

  // Current project
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  // Active panel
  activePanel: string;
  setActivePanel: (panel: string) => void;

  // Sidebar
  sidebarExpanded: boolean;
  toggleSidebar: () => void;

  // Status bar
  statusBarExpanded: boolean;
  toggleStatusBar: () => void;

  // Script data
  scriptData: Record<string, Episode> | null;
  setScriptData: (data: Record<string, Episode> | null) => void;

  // Settings
  settings: ProjectSettings;
  updateSettings: (settings: Partial<ProjectSettings>) => void;

  // System settings (persisted to backend)
  systemSettings: SystemSettings;
  systemSettingsLoaded: boolean;
  loadSystemSettings: () => Promise<void>;
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;
  saveSystemSettings: () => Promise<void>;

  // Extended state
  chapters: Chapter[];
  setChapters: (chapters: Chapter[]) => void;
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  sceneAssets: SceneAsset[];
  setSceneAssets: (assets: SceneAsset[]) => void;
  props: PropAsset[];
  setProps: (props: PropAsset[]) => void;
  analysis: StoryAnalysis | null;
  setAnalysis: (analysis: StoryAnalysis | null) => void;
  outlines: EpisodeOutline[];
  setOutlines: (outlines: EpisodeOutline[]) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.project_id !== id) })),
  updateProject: (id, data) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.project_id === id ? { ...p, ...data } : p)),
      currentProject:
        s.currentProject?.project_id === id
          ? { ...s.currentProject, ...data }
          : s.currentProject,
    })),

  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  activePanel: "novel",
  setActivePanel: (panel) => set({ activePanel: panel }),

  sidebarExpanded: localStorage.getItem("sidebar_expanded") !== "false",
  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarExpanded;
      localStorage.setItem("sidebar_expanded", String(next));
      return { sidebarExpanded: next };
    }),

  statusBarExpanded: false,
  toggleStatusBar: () => set((s) => ({ statusBarExpanded: !s.statusBarExpanded })),

  scriptData: null,
  setScriptData: (data) => set({ scriptData: data }),

  settings: (() => {
    const stored = localStorage.getItem("novel2toon_settings");
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    return { ...DEFAULT_SETTINGS };
  })(),
  updateSettings: (partial) =>
    set((s) => {
      const next = { ...s.settings, ...partial };
      localStorage.setItem("novel2toon_settings", JSON.stringify(next));
      return { settings: next };
    }),

  systemSettings: { ...DEFAULT_SYSTEM_SETTINGS },
  systemSettingsLoaded: false,
  loadSystemSettings: async () => {
    try {
      const data = await api.getSystemSettings();
      set({ systemSettings: { ...DEFAULT_SYSTEM_SETTINGS, ...data }, systemSettingsLoaded: true });
    } catch {
      set({ systemSettingsLoaded: true });
    }
  },
  updateSystemSettings: (partial) =>
    set((s) => ({ systemSettings: { ...s.systemSettings, ...partial } })),
  saveSystemSettings: async () => {
    const s = useProjectStore.getState().systemSettings;
    try {
      await api.updateSystemSettings(s);
    } catch {
      // silent
    }
  },

  // Extended state
  chapters: [],
  setChapters: (chapters) => set({ chapters }),
  characters: [],
  setCharacters: (characters) => set({ characters }),
  sceneAssets: [],
  setSceneAssets: (assets) => set({ sceneAssets: assets }),
  props: [],
  setProps: (props) => set({ props }),
  analysis: null,
  setAnalysis: (analysis) => set({ analysis }),
  outlines: [],
  setOutlines: (outlines) => set({ outlines }),
}));

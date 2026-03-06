import { create } from "zustand";
import type { Project, ProjectSettings, Character, SceneAsset, StoryAnalysis, EpisodeOutline, Chapter, Episode } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import { runMockPipeline, mockScriptData, mockCharacters, mockSceneAssets, mockAnalysis, mockOutlines } from "@/services/mock";

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

  // Extended state
  chapters: Chapter[];
  setChapters: (chapters: Chapter[]) => void;
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  sceneAssets: SceneAsset[];
  setSceneAssets: (assets: SceneAsset[]) => void;
  analysis: StoryAnalysis | null;
  setAnalysis: (analysis: StoryAnalysis | null) => void;
  outlines: EpisodeOutline[];
  setOutlines: (outlines: EpisodeOutline[]) => void;

  // Mock pipeline
  startMockPipeline: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
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

  // Extended state
  chapters: [],
  setChapters: (chapters) => set({ chapters }),
  characters: [],
  setCharacters: (characters) => set({ characters }),
  sceneAssets: [],
  setSceneAssets: (assets) => set({ sceneAssets: assets }),
  analysis: null,
  setAnalysis: (analysis) => set({ analysis }),
  outlines: [],
  setOutlines: (outlines) => set({ outlines }),

  // Mock pipeline
  startMockPipeline: () => {
    const { currentProject } = get();
    if (!currentProject) return;

    set({
      statusBarExpanded: true,
      currentProject: { ...currentProject, status: "running", progress: 0, current_step: "准备中..." },
    });

    runMockPipeline(
      (step, progress) => {
        const cp = get().currentProject;
        if (!cp) return;
        set({
          currentProject: { ...cp, status: "running", current_step: step, progress },
        });
      },
      () => {
        const cp = get().currentProject;
        if (!cp) return;
        set({
          currentProject: { ...cp, status: "completed", current_step: null, progress: 100 },
          scriptData: mockScriptData,
          characters: mockCharacters,
          sceneAssets: mockSceneAssets,
          analysis: mockAnalysis,
          outlines: mockOutlines,
        });
      },
    );
  },
}));

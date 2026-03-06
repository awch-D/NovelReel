export type ProjectStatus = "created" | "running" | "completed" | "error";

export interface Project {
  project_id: string;
  name: string;
  status: ProjectStatus;
  current_step: string | null;
  progress: number;
  error: string | null;
  created_at?: string;
  cover?: string;
}

export interface Episode {
  episode_id: string;
  label: string;
  scenes: Scene[];
}

export interface Scene {
  scene_id: string;
  location: string;
  time: string;
  shots: Shot[];
}

export interface Shot {
  shot_id: string;
  scene_id: string;
  description: string;
  characters: string[];
  location: string;
  dialogue: Dialogue[];
  camera?: string;
  vfx?: string;
  duration?: number;
  frame_status?: "pending" | "generating" | "generated" | "marked";
}

export interface Dialogue {
  character: string;
  text: string;
  emotion?: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  appearance: string;
  locked: boolean;
  reference_image?: string;
  candidates?: string[];
}

export interface SceneAsset {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  reference_image?: string;
  candidates?: string[];
}

export interface Chapter {
  index: number;
  title: string;
  start: number;
  end: number;
}

export type ImageProvider = "api" | "jimeng" | "mock";

export interface ProjectSettings {
  chapters_per_episode: number;
  visual_style: string;
  base_model: string;
  resolution: string;
  candidate_count: number;

  // LLM 接口
  llm_base_url: string;
  llm_api_key: string;
  llm_model: string;

  // 图片接口
  image_provider: ImageProvider;
  image_base_url: string;
  image_api_key: string;
  image_model: string;

  // 即梦专用
  jimeng_access_key: string;
  jimeng_secret_key: string;
}

export const VISUAL_STYLES = [
  { value: "anime_cel", label: "动漫赛璐璐" },
  { value: "comic_realistic", label: "写实漫画" },
  { value: "chinese_ink", label: "中国水墨" },
  { value: "webtoon", label: "韩漫风格" },
  { value: "pixar_3d", label: "3D 皮克斯" },
];

export const BASE_MODELS = [
  { value: "sdxl", label: "SDXL 1.0" },
  { value: "flux", label: "Flux.1-dev" },
];

export const RESOLUTIONS = [
  { value: "1920x1080", label: "1920×1080 (16:9)" },
  { value: "1080x1920", label: "1080×1920 (9:16 竖屏)" },
  { value: "1080x1080", label: "1080×1080 (1:1)" },
];

export const EMOTIONS = [
  "neutral", "happy", "sad", "angry", "fearful", "surprised", "determined", "disgusted",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export interface StoryAnalysis {
  theme: string;
  tone: string;
  era: string;
  core_conflict: string;
  character_names: string[];
  scene_names: string[];
}

export interface EpisodeOutline {
  episode: number;
  title: string;
  summary: string;
  chapters: string;
}

export interface PipelineStep {
  name: string;
  status: "pending" | "running" | "completed";
  progress: number;
}

export const IMAGE_PROVIDERS: { value: ImageProvider; label: string }[] = [
  { value: "mock", label: "Mock（不生成图片）" },
  { value: "api", label: "OpenAI Images API" },
  { value: "jimeng", label: "即梦 Seedream" },
];

export const DEFAULT_SETTINGS: ProjectSettings = {
  chapters_per_episode: 2,
  visual_style: "anime_cel",
  base_model: "sdxl",
  resolution: "1920x1080",
  candidate_count: 4,
  llm_base_url: "",
  llm_api_key: "",
  llm_model: "",
  image_provider: "mock",
  image_base_url: "",
  image_api_key: "",
  image_model: "",
  jimeng_access_key: "",
  jimeng_secret_key: "",
};

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
  views?: Partial<Record<CharacterView, string>>;
  core_views_status?: 'none' | 'generating' | 'done';
}

export interface SceneAsset {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  reference_image?: string;
  candidates?: string[];
  views?: Partial<Record<SceneView, string>>;
  core_views_status?: 'none' | 'generating' | 'done';
}

export interface PropAsset {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  reference_image?: string;
  candidates?: string[];
}

export interface LibraryVersion {
  version: string;
  url: string;
}

export interface Chapter {
  index: number;
  title: string;
  start: number;
  end: number;
}

export type ImageProvider = "api" | "jimeng" | "mock";
export type VideoProvider = "none" | "jimeng";

// 系统级设置（API 接口配置，保存到后端）
export interface SystemSettings {
  // LLM
  llm_base_url: string;
  llm_api_key: string;
  llm_model: string;

  // 图片生成
  image_provider: ImageProvider;
  image_base_url: string;
  image_api_key: string;
  image_model: string;
  jimeng_image_access_key: string;
  jimeng_image_secret_key: string;

  // 视频生成
  video_provider: VideoProvider;
  jimeng_video_access_key: string;
  jimeng_video_secret_key: string;
}

// 项目级设置
export interface ProjectSettings {
  chapters_per_episode: number;
  visual_style: string;
  base_model: string;
  resolution: string;
  candidate_count: number;

  // LLM 接口（兼容旧数据，运行时从 systemSettings 合并）
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

export type CharacterView = 'front' | 'side' | 'back';
export type SceneView = 'establishing' | 'eye_level' | 'extreme' | 'detail';

export const CHARACTER_VIEWS: { key: CharacterView; label: string }[] = [
  { key: 'front', label: '正面全身' },
  { key: 'side', label: '侧面' },
  { key: 'back', label: '背面' },
];

export const SCENE_VIEWS: { key: SceneView; label: string }[] = [
  { key: 'establishing', label: '全景远景' },
  { key: 'eye_level', label: '中景平视' },
  { key: 'extreme', label: '极端角度' },
  { key: 'detail', label: '细节特写' },
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

export const VIDEO_PROVIDERS: { value: VideoProvider; label: string }[] = [
  { value: "none", label: "不生成视频" },
  { value: "jimeng", label: "即梦视频生成 3.0 Pro" },
];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  llm_base_url: "",
  llm_api_key: "",
  llm_model: "",
  image_provider: "mock",
  image_base_url: "",
  image_api_key: "",
  image_model: "",
  jimeng_image_access_key: "",
  jimeng_image_secret_key: "",
  video_provider: "none",
  jimeng_video_access_key: "",
  jimeng_video_secret_key: "",
};

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

export interface VoiceProfile {
  id: string;
  name: string;
  has_ref_audio: boolean;
  ref_audio_url: string | null;
  config: { language?: string; prompt_text?: string };
}

export interface DialogueLine {
  line_id: string;
  shot_id: string;
  char_id: string;
  text: string;
  emotion: string;
  audio_url: string | null;
  status: "pending" | "done";
}

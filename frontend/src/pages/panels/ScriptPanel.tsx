import { useState } from "react";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";
import { EpisodeTabs } from "@/components/shared/EpisodeTabs";
import { MessageSquare, Camera, MapPin, Users, BookOpen, Clock, Sparkles, ImageOff } from "lucide-react";
import type { Shot, Dialogue, Episode } from "@/types";

const SUB_TABS = [
  { id: "analysis", label: "分析结果" },
  { id: "outline", label: "大纲" },
  { id: "script", label: "剧本" },
  { id: "storyboard", label: "分镜脚本" },
];

const EMOTION_COLORS: Record<string, string> = {
  neutral: "bg-gray-500/20 text-gray-300",
  happy: "bg-yellow-500/20 text-yellow-300",
  sad: "bg-blue-500/20 text-blue-300",
  angry: "bg-red-500/20 text-red-300",
  fearful: "bg-purple-500/20 text-purple-300",
  surprised: "bg-orange-500/20 text-orange-300",
  determined: "bg-emerald-500/20 text-emerald-300",
  disgusted: "bg-lime-500/20 text-lime-300",
};

export function ScriptPanel() {
  const { currentProject, scriptData, analysis, outlines } = useProjectStore();
  const [subTab, setSubTab] = useState("script");
  const [activeEpisode, setActiveEpisode] = useState("E01");

  const episodes: string[] = scriptData
    ? Object.keys(scriptData).filter((k) => k.startsWith("E") || k.startsWith("e"))
    : [];

  const episodeData = scriptData?.[activeEpisode] as
    | { scenes?: { scene_id: string; location: string; shots: Shot[] }[] }
    | undefined;
  const scenes = episodeData?.scenes || [];

  return (
    <div className="h-full flex flex-col">
      {/* Sub tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              subTab === tab.id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {subTab === "analysis" ? (
          <AnalysisTab />
        ) : subTab === "outline" ? (
          <OutlineTab />
        ) : subTab === "storyboard" ? (
          <StoryboardTab scriptData={scriptData} activeEpisode={activeEpisode} setActiveEpisode={setActiveEpisode} episodes={episodes} />
        ) : !scriptData ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <p className="text-lg mb-1">暂无剧本数据</p>
              <p className="text-sm">请先在小说管理面板上传文件并运行生成</p>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {episodes.length > 0 && (
              <EpisodeTabs episodes={episodes} active={activeEpisode} onChange={setActiveEpisode} />
            )}
            {scenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">当前集暂无场景数据</p>
            ) : (
              scenes.map((scene, si) => (
                <div key={scene.scene_id || si} className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>场景 {si + 1}: {scene.location}</span>
                  </div>
                  <div className="space-y-2 pl-6">
                    {scene.shots?.map((shot, shi) => (
                      <ShotCard key={shot.shot_id || shi} shot={shot} index={shi} episodeLabel={activeEpisode} sceneIndex={si} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 分析结果 Tab
function AnalysisTab() {
  const { analysis, characters, sceneAssets } = useProjectStore();

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg mb-1">暂无分析数据</p>
          <p className="text-sm">运行生成后将自动分析</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-3xl">
      <div className="grid grid-cols-2 gap-4">
        <InfoCard label="主题" value={analysis.theme} />
        <InfoCard label="基调" value={analysis.tone} />
        <InfoCard label="时代背景" value={analysis.era} />
        <InfoCard label="核心冲突" value={analysis.core_conflict} />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">角色 ({characters.length})</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {characters.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card/50">
              {c.reference_image ? (
                <img src={c.reference_image} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs">{c.name[0]}</div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">场景 ({sceneAssets.length})</h3>
        <div className="grid grid-cols-2 gap-3">
          {sceneAssets.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card/50">
              {s.reference_image ? (
                <img src={s.reference_image} alt={s.name} className="w-16 h-10 rounded object-cover" />
              ) : (
                <div className="w-16 h-10 rounded bg-muted flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 border border-border rounded-lg bg-card/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

// 大纲 Tab
function OutlineTab() {
  const { outlines } = useProjectStore();

  if (outlines.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg mb-1">暂无大纲数据</p>
          <p className="text-sm">运行生成后将自动创建大纲</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      {outlines.map((o) => (
        <div key={o.episode} className="border border-border rounded-lg p-4 bg-card/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">第 {o.episode} 集: {o.title}</span>
            <span className="text-xs text-muted-foreground">{o.chapters}</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{o.summary}</p>
        </div>
      ))}
    </div>
  );
}

// 分镜脚本 Tab
function StoryboardTab({
  scriptData,
  activeEpisode,
  setActiveEpisode,
  episodes,
}: {
  scriptData: Record<string, Episode> | null;
  activeEpisode: string;
  setActiveEpisode: (ep: string) => void;
  episodes: string[];
}) {
  const { currentProject } = useProjectStore();

  if (!scriptData) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg mb-1">暂无分镜脚本</p>
          <p className="text-sm">运行生成后将自动创建分镜</p>
        </div>
      </div>
    );
  }

  const episodeData = scriptData[activeEpisode] as
    | { scenes?: { scene_id: string; location: string; shots: Shot[] }[] }
    | undefined;

  const allShots: { shot: Shot; sceneIndex: number; shotIndex: number; label: string }[] = [];
  episodeData?.scenes?.forEach((scene, si) => {
    scene.shots?.forEach((shot, shi) => {
      allShots.push({
        shot,
        sceneIndex: si,
        shotIndex: shi,
        label: `${activeEpisode} · S${String(si + 1).padStart(2, "0")} · ${String(shi + 1).padStart(3, "0")}`,
      });
    });
  });

  return (
    <div className="p-4 space-y-4">
      {episodes.length > 0 && (
        <EpisodeTabs episodes={episodes} active={activeEpisode} onChange={setActiveEpisode} />
      )}

      <div className="space-y-2">
        {allShots.map((s) => {
          const frameSrc = currentProject
            ? api.getFrameUrl(currentProject.project_id, `episode_${activeEpisode.replace(/^E0?/, "")}`, s.shot.shot_id)
            : "";
          return (
            <div key={s.shot.shot_id} className="flex items-start gap-4 border border-border rounded-lg p-3 bg-card/50">
              <FrameImage src={frameSrc} alt={s.label} />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{s.label}</span>
                  {s.shot.camera && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      {s.shot.camera}
                    </span>
                  )}
                  {s.shot.duration && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {s.shot.duration}s
                    </span>
                  )}
                </div>
                <p className="text-sm">{s.shot.description}</p>
                {s.shot.characters.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    {s.shot.characters.map((c) => (
                      <span key={c} className="text-xs bg-secondary px-1.5 py-0.5 rounded">{c}</span>
                    ))}
                  </div>
                )}
                {s.shot.dialogue?.map((d, di) => (
                  <div key={di} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="font-medium shrink-0">{d.character}:</span>
                    <span>{d.text}</span>
                    {d.emotion && (
                      <span className={cn("px-1 py-0.5 rounded text-[10px]", EMOTION_COLORS[d.emotion] || EMOTION_COLORS.neutral)}>
                        {d.emotion}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShotCard({
  shot,
  index,
  episodeLabel,
  sceneIndex,
}: {
  shot: Shot;
  index: number;
  episodeLabel: string;
  sceneIndex: number;
}) {
  const label = `${episodeLabel} · S${String(sceneIndex + 1).padStart(2, "0")} · ${String(index + 1).padStart(3, "0")}`;

  return (
    <div className="border border-border rounded-lg p-4 bg-card/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">{label}</span>
        {shot.camera && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Camera className="w-3 h-3" />
            {shot.camera}
          </span>
        )}
      </div>

      <p className="text-sm">{shot.description}</p>

      {shot.characters && shot.characters.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          {shot.characters.map((c) => (
            <span key={c} className="text-xs bg-secondary px-1.5 py-0.5 rounded">
              {c}
            </span>
          ))}
        </div>
      )}

      {shot.dialogue && shot.dialogue.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border">
          {shot.dialogue.map((d: Dialogue, di: number) => (
            <div key={di} className="flex items-start gap-2 text-sm">
              <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
              <span className="font-medium shrink-0">{d.character}:</span>
              <span className="text-muted-foreground flex-1">{d.text}</span>
              {d.emotion && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded shrink-0",
                    EMOTION_COLORS[d.emotion] || EMOTION_COLORS.neutral
                  )}
                >
                  {d.emotion}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FrameImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div className="w-32 h-[72px] rounded shrink-0 bg-muted/50 flex flex-col items-center justify-center">
        <ImageOff className="w-5 h-5 text-muted-foreground/40" />
        <span className="text-[10px] text-muted-foreground/60 mt-1">未生成</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="w-32 h-[72px] rounded object-cover shrink-0 bg-muted"
      onError={() => setFailed(true)}
    />
  );
}

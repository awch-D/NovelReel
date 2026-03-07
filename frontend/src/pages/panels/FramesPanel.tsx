import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { EpisodeTabs } from "@/components/shared/EpisodeTabs";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "../dialogs/ImagePreview";
import { Image, Play, RefreshCw, Loader2, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Shot } from "@/types";

interface FrameInfo {
  shot_id: string;
  status: string;
  url: string | null;
}

export function FramesPanel() {
  const { currentProject, scriptData } = useProjectStore();
  const [activeEpisode, setActiveEpisode] = useState("E01");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [frameList, setFrameList] = useState<FrameInfo[]>([]);
  const [generating, setGenerating] = useState(false);

  const episodes: string[] = scriptData
    ? Object.keys(scriptData).filter((k) => k.startsWith("E") || k.startsWith("e"))
    : [];

  const episodeData = scriptData?.[activeEpisode] as
    | { scenes?: { scene_id: string; shots: Shot[] }[] }
    | undefined;

  const allShots: { shot: Shot; sceneIndex: number; shotIndex: number }[] = [];
  episodeData?.scenes?.forEach((scene, si) => {
    scene.shots?.forEach((shot, shi) => {
      allShots.push({ shot, sceneIndex: si, shotIndex: shi });
    });
  });

  const epNum = activeEpisode.replace(/^E0?/, "");
  const episodeDir = `episode_${epNum}`;
  const pid = currentProject?.project_id;

  const fetchFrameList = useCallback(() => {
    if (!pid) return;
    api.getFrameList(pid, episodeDir).then(setFrameList).catch(() => {});
  }, [pid, episodeDir]);

  useEffect(() => {
    fetchFrameList();
    setSelected(new Set());
  }, [fetchFrameList]);

  // Poll while generating
  useEffect(() => {
    const hasGenerating = frameList.some((f) => f.status === "generating");
    if (!hasGenerating) return;
    const timer = setInterval(fetchFrameList, 3000);
    return () => clearInterval(timer);
  }, [frameList, fetchFrameList]);

  const frameStatusMap = new Map(frameList.map((f) => [f.shot_id, f]));

  const images = allShots.map((s, i) => {
    const fi = frameStatusMap.get(s.shot.shot_id);
    const label = `${activeEpisode} · S${String(s.sceneIndex + 1).padStart(2, "0")} · ${String(s.shotIndex + 1).padStart(3, "0")}`;
    const src = fi?.url && pid ? `${fi.url}?t=${Date.now()}` : (pid ? api.getFrameUrl(pid, episodeDir, s.shot.shot_id) : "");
    const status = fi?.status || s.shot.frame_status || "pending";
    return {
      id: s.shot.shot_id || String(i),
      src: status !== "pending" ? src : "",
      label,
      status,
    };
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerateAll = async () => {
    if (!pid) return;
    setGenerating(true);
    try {
      await api.generateEpisodeFrames(pid, episodeDir);
      setTimeout(fetchFrameList, 1000);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSelected = async () => {
    if (!pid || selected.size === 0) return;
    setGenerating(true);
    try {
      await api.regenerateFrameBatch(pid, episodeDir, Array.from(selected));
      setSelected(new Set());
      setTimeout(fetchFrameList, 1000);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateFrame = async (shotId: string) => {
    if (!pid) return;
    await api.regenerateFrame(pid, episodeDir, shotId);
    setTimeout(fetchFrameList, 1000);
  };

  const handleMarkFrame = async (shotId: string) => {
    if (!pid) return;
    await api.markFrame(pid, episodeDir, shotId);
    fetchFrameList();
  };

  if (!scriptData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Image className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg mb-1">暂无分镜数据</p>
        <p className="text-sm">请先运行剧本生成</p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { text: string; cls: string }> = {
      pending: { text: "待生成", cls: "bg-muted text-muted-foreground" },
      generating: { text: "生成中", cls: "bg-blue-500/80 text-white animate-pulse" },
      generated: { text: "已生成", cls: "bg-green-500/80 text-white" },
      marked: { text: "已标记", cls: "bg-orange-500/80 text-white" },
    };
    const s = map[status] || map.pending;
    return <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", s.cls)}>{s.text}</span>;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-border">
        <EpisodeTabs episodes={episodes} active={activeEpisode} onChange={setActiveEpisode} />
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="text-xs h-7" onClick={handleGenerateAll} disabled={generating}>
          {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
          生成本集
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-7"
          onClick={handleRegenerateSelected}
          disabled={generating || selected.size === 0}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          重新生成选中 ({selected.size})
        </Button>
        <span className="text-xs text-muted-foreground">{allShots.length} 个镜头</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {allShots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">当前集暂无镜头</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {images.map((img) => (
              <div
                key={img.id}
                className={cn(
                  "group relative aspect-[16/9] rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
                  selected.has(img.id) ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-primary/50"
                )}
                onClick={() => {
                  const idx = images.findIndex((i) => i.id === img.id);
                  setPreviewIndex(idx >= 0 ? idx : null);
                }}
              >
                {img.src ? (
                  <img src={img.src} alt={img.label} className="w-full h-full object-cover" loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement?.classList.add("bg-muted"); }}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">待生成</div>
                )}

                {/* Select checkbox */}
                <button
                  className="absolute top-1.5 left-1.5 p-0.5 rounded bg-black/40 hover:bg-black/60 transition-colors"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(img.id); }}
                >
                  {selected.has(img.id) ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4 text-white/60" />
                  )}
                </button>

                {/* Status badge */}
                <div className="absolute top-1.5 right-1.5">{statusBadge(img.status)}</div>

                {img.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                    <span className="text-xs text-white truncate block">{img.label}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {previewIndex !== null && (
        <ImagePreview
          images={images}
          currentIndex={previewIndex}
          shots={allShots.map((s) => s.shot)}
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
          onRegenerate={(shotId) => { handleRegenerateFrame(shotId); }}
          onMark={(shotId) => { handleMarkFrame(shotId); }}
        />
      )}
    </div>
  );
}

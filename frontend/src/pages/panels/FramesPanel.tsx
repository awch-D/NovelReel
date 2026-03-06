import { useState } from "react";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { EpisodeTabs } from "@/components/shared/EpisodeTabs";
import { ImageGrid } from "@/components/shared/ImageGrid";
import { ImagePreview } from "../dialogs/ImagePreview";
import { Image } from "lucide-react";
import type { Shot } from "@/types";

export function FramesPanel() {
  const { currentProject, scriptData } = useProjectStore();
  const [activeEpisode, setActiveEpisode] = useState("E01");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

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

  const images = allShots.map((s, i) => {
    const label = `${activeEpisode} · S${String(s.sceneIndex + 1).padStart(2, "0")} · ${String(s.shotIndex + 1).padStart(3, "0")}`;
    const epNum = activeEpisode.replace(/^E0?/, "");
    const src = currentProject
      ? api.getFrameUrl(currentProject.project_id, `episode_${epNum}`, s.shot.shot_id)
      : "";
    return {
      id: s.shot.shot_id || String(i),
      src,
      label,
      status: s.shot.frame_status || "pending",
    };
  });

  if (!scriptData) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <Image className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-lg mb-1">暂无分镜数据</p>
        <p className="text-sm">请先运行剧本生成</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 border-b border-border">
        <EpisodeTabs episodes={episodes} active={activeEpisode} onChange={setActiveEpisode} />
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{allShots.length} 个镜头</span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {allShots.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center mt-8">当前集暂无镜头</p>
        ) : (
          <ImageGrid
            images={images}
            columns={4}
            onSelect={(id) => {
              const idx = images.findIndex((img) => img.id === id);
              setPreviewIndex(idx >= 0 ? idx : null);
            }}
          />
        )}
      </div>

      {previewIndex !== null && (
        <ImagePreview
          images={images}
          currentIndex={previewIndex}
          shots={allShots.map((s) => s.shot)}
          onClose={() => setPreviewIndex(null)}
          onNavigate={setPreviewIndex}
        />
      )}
    </div>
  );
}

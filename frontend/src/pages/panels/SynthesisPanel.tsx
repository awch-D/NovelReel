import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Film, Upload, Play, Pause, Download, Loader2, Music, Type } from "lucide-react";
import { cn } from "@/lib/utils";

interface EpisodeStatus {
  episode: string;
  status: string;
  url: string | null;
}

interface BGMItem {
  name: string;
  path: string;
  url: string;
  category?: string;
}

export function SynthesisPanel() {
  const { currentProject, scriptData } = useProjectStore();
  const pid = currentProject?.project_id;

  const [episodes, setEpisodes] = useState<EpisodeStatus[]>([]);
  const [currentEp, setCurrentEp] = useState<string>("");
  const [assembling, setAssembling] = useState(false);
  const [settings, setSettings] = useState({ bgm: null as string | null, bgm_volume: 0.15, subtitles: true, font_size: 24 });
  const [bgmList, setBgmList] = useState<BGMItem[]>([]);
  const [presetList, setPresetList] = useState<BGMItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Load status
  useEffect(() => {
    if (!pid) return;
    api.getSynthesisStatus(pid).then((data) => {
      setEpisodes(data.episodes);
      if (data.episodes.length > 0 && !currentEp) setCurrentEp(data.episodes[0].episode);
    }).catch(() => {});
    api.getSynthesisSettings(pid).then(setSettings).catch(() => {});
    api.listBGM(pid).then(setBgmList).catch(() => {});
    api.listBGMPresets(pid).then(setPresetList).catch(() => {});
  }, [pid]);

  // Update preview when episode changes
  useEffect(() => {
    if (!pid || !currentEp) return;
    const ep = episodes.find((e) => e.episode === currentEp);
    setPreviewUrl(ep?.status === "done" ? api.getEpisodePreviewUrl(pid, currentEp) : null);
  }, [currentEp, episodes, pid]);

  const handleAssemble = async () => {
    if (!pid || !currentEp) return;
    setAssembling(true);
    try {
      await api.assembleEpisode(pid, currentEp);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const data = await api.getSynthesisStatus(pid);
        setEpisodes(data.episodes);
        const ep = data.episodes.find((e) => e.episode === currentEp);
        if (ep?.status === "done") {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setAssembling(false);
          setPreviewUrl(api.getEpisodePreviewUrl(pid, currentEp));
        }
      }, 3000);
      setTimeout(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } setAssembling(false); }, 300000);
    } catch {
      setAssembling(false);
    }
  };

  const handleAssembleAll = async () => {
    if (!pid) return;
    setAssembling(true);
    try {
      await api.assembleAll(pid);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const data = await api.getSynthesisStatus(pid);
        setEpisodes(data.episodes);
        if (data.episodes.every((e) => e.status === "done")) {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          setAssembling(false);
        }
      }, 5000);
      setTimeout(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } setAssembling(false); }, 600000);
    } catch {
      setAssembling(false);
    }
  };

  const handleUploadBGM = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !pid) return;
      const res = await api.uploadBGM(pid, file);
      setSettings((s) => ({ ...s, bgm: res.path }));
      await api.updateSynthesisSettings(pid, { ...settings, bgm: res.path });
      const list = await api.listBGM(pid);
      setBgmList(list);
    };
    input.click();
  };

  const handleSettingChange = async (key: string, value: unknown) => {
    if (!pid) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await api.updateSynthesisSettings(pid, next);
  };

  if (!pid) return null;

  return (
    <div className="flex h-full">
      {/* Left: Settings */}
      <div className="w-72 border-r border-border p-4 overflow-y-auto shrink-0 space-y-5">
        {/* BGM */}
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Music className="w-4 h-4" /> 背景音乐
          </h3>
          <select
            className="w-full h-8 px-2 rounded border border-border bg-background text-sm mb-2"
            value={settings.bgm || ""}
            onChange={(e) => handleSettingChange("bgm", e.target.value || null)}
          >
            <option value="">无 BGM</option>
            {bgmList.length > 0 && (
              <optgroup label="已上传">
                {bgmList.map((b) => (
                  <option key={b.path} value={b.path}>{b.name}</option>
                ))}
              </optgroup>
            )}
            {presetList.length > 0 && (
              <optgroup label="预设">
                {presetList.map((b) => (
                  <option key={b.path} value={b.path}>{b.category}/{b.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={handleUploadBGM}>
            <Upload className="w-3 h-3 mr-1" /> 上传 BGM
          </Button>
          <div className="mt-2">
            <label className="text-xs text-muted-foreground">音量: {Math.round(settings.bgm_volume * 100)}%</label>
            <input
              type="range"
              min={0} max={100} step={5}
              value={settings.bgm_volume * 100}
              onChange={(e) => handleSettingChange("bgm_volume", Number(e.target.value) / 100)}
              className="w-full h-1.5 mt-1"
            />
          </div>
        </div>

        {/* Subtitles */}
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Type className="w-4 h-4" /> 字幕
          </h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.subtitles}
              onChange={(e) => handleSettingChange("subtitles", e.target.checked)}
              className="rounded"
            />
            启用字幕
          </label>
          {settings.subtitles && (
            <div className="mt-2">
              <label className="text-xs text-muted-foreground">字号: {settings.font_size}px</label>
              <input
                type="range"
                min={16} max={48} step={2}
                value={settings.font_size}
                onChange={(e) => handleSettingChange("font_size", Number(e.target.value))}
                className="w-full h-1.5 mt-1"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right: Timeline + Preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <select
            className="h-8 px-2 rounded border border-border bg-background text-sm"
            value={currentEp}
            onChange={(e) => setCurrentEp(e.target.value)}
          >
            {episodes.map((ep) => (
              <option key={ep.episode} value={ep.episode}>
                第 {ep.episode.replace("episode_", "")} 集
                {ep.status === "done" ? " ✓" : ""}
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={handleAssemble} disabled={assembling}>
            {assembling ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Film className="w-3.5 h-3.5 mr-1" />}
            合成本集
          </Button>
          <Button size="sm" variant="outline" onClick={handleAssembleAll} disabled={assembling}>
            合成全部
          </Button>
        </div>

        {/* Episode timeline */}
        <div className="p-3 border-b border-border">
          <div className="flex gap-1 h-8">
            {episodes.map((ep) => (
              <div
                key={ep.episode}
                className={cn(
                  "flex-1 rounded text-[10px] flex items-center justify-center cursor-pointer transition-colors",
                  ep.status === "done" ? "bg-green-500/20 text-green-400" : "bg-muted text-muted-foreground",
                  currentEp === ep.episode && "ring-1 ring-primary"
                )}
                onClick={() => setCurrentEp(ep.episode)}
              >
                {ep.episode.replace("episode_", "E")}
              </div>
            ))}
          </div>
        </div>

        {/* Video preview */}
        <div className="flex-1 flex items-center justify-center p-4">
          {previewUrl ? (
            <div className="w-full max-w-3xl">
              <video
                ref={videoRef}
                src={previewUrl}
                controls
                className="w-full rounded-lg border border-border"
              />
              <div className="flex justify-end mt-2">
                <a href={previewUrl} download className="inline-flex">
                  <Button size="sm" variant="outline">
                    <Download className="w-3.5 h-3.5 mr-1" /> 下载视频
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              {assembling ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">正在合成视频...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Film className="w-8 h-8 opacity-50" />
                  <p className="text-sm">选择集数并点击「合成本集」生成视频</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

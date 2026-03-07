import { useState, useEffect, useRef } from "react";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import type { VoiceProfile, DialogueLine } from "@/types";
import { Button } from "@/components/ui/button";
import { Upload, Play, Pause, RefreshCw, Mic, TestTube, Merge, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function VoicePanel() {
  const { currentProject, scriptData } = useProjectStore();
  const pid = currentProject?.project_id;

  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [dialogues, setDialogues] = useState<DialogueLine[]>([]);
  const [episodes, setEpisodes] = useState<string[]>([]);
  const [currentEp, setCurrentEp] = useState<string>("");
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [ttsStatus, setTtsStatus] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      audioRef.current?.pause();
    };
  }, []);

  // Extract episodes from scriptData
  useEffect(() => {
    if (!scriptData) return;
    const eps = Object.keys(scriptData).filter((k) => k.startsWith("E"));
    const mapped = eps.map((k) => `episode_${k.replace("E", "")}`);
    setEpisodes(mapped);
    if (mapped.length > 0 && !currentEp) setCurrentEp(mapped[0]);
  }, [scriptData]);

  // Load voice characters
  useEffect(() => {
    if (!pid) return;
    api.getVoiceCharacters(pid).then(setVoices).catch(() => {});
  }, [pid]);

  // Load dialogues for current episode
  useEffect(() => {
    if (!pid || !currentEp) return;
    api.getDialogues(pid, currentEp).then(setDialogues).catch(() => {});
  }, [pid, currentEp]);

  const handleUploadRef = async (charId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !pid) return;
      await api.uploadRefAudio(pid, charId, file);
      const updated = await api.getVoiceCharacters(pid);
      setVoices(updated);
    };
    input.click();
  };

  const handleGenerateSingle = async (lineId: string) => {
    if (!pid) return;
    setGenerating((s) => new Set(s).add(lineId));
    try {
      await api.generateTTS(pid, lineId);
      const updated = await api.getDialogues(pid, currentEp);
      setDialogues(updated);
    } finally {
      setGenerating((s) => { const n = new Set(s); n.delete(lineId); return n; });
    }
  };

  const handleGenerateAll = async () => {
    if (!pid || !currentEp) return;
    await api.generateAllTTS(pid, currentEp);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const updated = await api.getDialogues(pid, currentEp);
      setDialogues(updated);
      if (updated.every((d) => d.status === "done") && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
    setTimeout(() => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } }, 120000);
  };

  const handleMerge = async () => {
    if (!pid || !currentEp) return;
    await api.mergeDialogues(pid, currentEp);
  };

  const handleTestTTS = async () => {
    if (!pid) return;
    setTtsStatus("testing");
    try {
      const res = await api.testTTS(pid);
      setTtsStatus(res.message);
    } catch {
      setTtsStatus("连接失败");
    }
    setTimeout(() => setTtsStatus(null), 3000);
  };

  const playAudio = (lineId: string, url: string) => {
    if (playingId === lineId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(lineId);
  };

  if (!pid) return null;

  return (
    <div className="flex h-full">
      {/* Left: Character voice config */}
      <div className="w-72 border-r border-border p-4 overflow-y-auto shrink-0">
        <h3 className="text-sm font-medium mb-3">角色语音配置</h3>
        <div className="space-y-3">
          {voices.map((v) => (
            <div
              key={v.id}
              className={cn(
                "p-3 rounded-lg border cursor-pointer transition-colors",
                selectedChar === v.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
              )}
              onClick={() => setSelectedChar(v.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{v.name}</span>
                {v.has_ref_audio && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">已配置</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => { e.stopPropagation(); handleUploadRef(v.id); }}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  参考音频
                </Button>
                {v.has_ref_audio && v.ref_audio_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={(e) => { e.stopPropagation(); playAudio(`ref_${v.id}`, v.ref_audio_url!); }}
                  >
                    {playingId === `ref_${v.id}` ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {voices.length === 0 && (
            <p className="text-xs text-muted-foreground">运行 pipeline 后将显示角色列表</p>
          )}
        </div>
      </div>

      {/* Right: Dialogue list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <select
            className="h-8 px-2 rounded border border-border bg-background text-sm"
            value={currentEp}
            onChange={(e) => setCurrentEp(e.target.value)}
          >
            {episodes.map((ep) => (
              <option key={ep} value={ep}>
                第 {ep.replace("episode_", "")} 集
              </option>
            ))}
          </select>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={handleTestTTS}>
            <TestTube className="w-3.5 h-3.5 mr-1" />
            {ttsStatus === "testing" ? "测试中..." : ttsStatus || "测试 TTS"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleGenerateAll}>
            <Mic className="w-3.5 h-3.5 mr-1" />
            生成本集全部
          </Button>
          <Button size="sm" variant="outline" onClick={handleMerge}>
            <Merge className="w-3.5 h-3.5 mr-1" />
            合并对白
          </Button>
        </div>

        {/* Dialogue lines */}
        <div className="flex-1 overflow-y-auto p-3">
          {dialogues.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {currentEp ? "该集暂无对白数据" : "请选择集数"}
            </div>
          ) : (
            <div className="space-y-2">
              {dialogues.map((line) => (
                <div
                  key={line.line_id}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-accent/30 transition-colors"
                >
                  {/* Character name */}
                  <span className="text-xs font-medium w-16 shrink-0 truncate text-primary">
                    {voices.find((v) => v.id === line.char_id)?.name || line.char_id}
                  </span>

                  {/* Text */}
                  <span className="flex-1 text-sm truncate">{line.text}</span>

                  {/* Emotion badge */}
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded shrink-0", EMOTION_COLORS[line.emotion] || EMOTION_COLORS.neutral)}>
                    {line.emotion}
                  </span>

                  {/* Status */}
                  {line.status === "done" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 shrink-0">已生成</span>
                  )}

                  {/* Play */}
                  {line.audio_url && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => playAudio(line.line_id, line.audio_url!)}
                    >
                      {playingId === line.line_id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                  )}

                  {/* Generate / Regenerate */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    disabled={generating.has(line.line_id)}
                    onClick={() => handleGenerateSingle(line.line_id)}
                  >
                    {generating.has(line.line_id) ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

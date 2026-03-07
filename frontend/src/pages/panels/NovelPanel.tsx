import { useState, useRef, useCallback, useEffect } from "react";
import { useProjectStore } from "@/stores/project";
import { useProject } from "@/hooks/useProject";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Play, Loader2, BookOpen, ArrowUp, ArrowDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Chapter } from "@/types";

const CHAPTER_RE = /^[\s]*第[一二三四五六七八九十百千\d]+[章节回卷集篇]/m;

function parseChapters(text: string): Chapter[] {
  const chapters: Chapter[] = [];
  const lines = text.split("\n");
  let currentChapter: Chapter | null = null;

  lines.forEach((line, i) => {
    if (CHAPTER_RE.test(line)) {
      if (currentChapter) {
        currentChapter.end = i - 1;
        chapters.push(currentChapter);
      }
      currentChapter = {
        index: chapters.length,
        title: line.trim(),
        start: i,
        end: lines.length - 1,
      };
    }
  });

  if (currentChapter) {
    chapters.push(currentChapter);
  }

  return chapters;
}

export function NovelPanel() {
  const { currentProject, settings, setChapters: storeSetChapters } = useProjectStore();
  const { runPipeline } = useProject();
  const [text, setText] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const textRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 加载已有小说文本
  useEffect(() => {
    if (text || !currentProject) return;
    api.getNovel(currentProject.project_id).then((content) => {
      if (!content) return;
      setText(content);
      setFileName("novel.txt");
      const parsed = parseChapters(content);
      setChapters(parsed);
      storeSetChapters(parsed);
    });
  }, [currentProject?.project_id]);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
      setFileName(file.name);
      const parsed = parseChapters(content);
      setChapters(parsed);
      storeSetChapters(parsed);
    };
    reader.readAsText(file, "UTF-8");
  }, [storeSetChapters]);

  const handleFiles = useCallback((files: File[]) => {
    if (files.length === 1) {
      handleFile(files[0]);
    } else {
      setPendingFiles(files);
    }
  }, [handleFile]);

  const confirmMerge = useCallback(() => {
    if (pendingFiles.length === 0) return;
    const readers = pendingFiles.map((f) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(f, "UTF-8");
      });
    });
    Promise.all(readers).then((texts) => {
      const merged = texts.join("\n\n");
      setText(merged);
      setFileName(pendingFiles.map((f) => f.name).join(" + "));
      const parsed = parseChapters(merged);
      setChapters(parsed);
      storeSetChapters(parsed);
      setPendingFiles([]);
    });
  }, [pendingFiles, storeSetChapters]);

  const movePendingFile = (index: number, dir: -1 | 1) => {
    const next = [...pendingFiles];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPendingFiles(next);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith(".txt"));
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles]
  );

  const handleRun = async () => {
    setRunning(true);
    try {
      await runPipeline();
    } catch (err) {
      alert("启动失败: " + (err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const scrollToChapter = (ch: Chapter) => {
    setActiveChapter(ch.index);
    if (textRef.current) {
      const lines = textRef.current.querySelectorAll("[data-line]");
      const target = lines[ch.start];
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 分集预览
  const cpe = settings.chapters_per_episode;
  const episodeGroups: { episode: number; chapters: Chapter[] }[] = [];
  for (let i = 0; i < chapters.length; i += cpe) {
    episodeGroups.push({
      episode: episodeGroups.length + 1,
      chapters: chapters.slice(i, i + cpe),
    });
  }

  if (!text) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        {pendingFiles.length > 0 ? (
          <div className="w-full max-w-lg border rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-medium">排列文件顺序</h3>
            <p className="text-sm text-muted-foreground">拖拽或使用箭头调整文件合并顺序</p>
            <div className="space-y-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded border border-border bg-card">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 truncate">{f.name}</span>
                  <button onClick={() => movePendingFile(i, -1)} disabled={i === 0} className="p-1 hover:bg-accent rounded disabled:opacity-30">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => movePendingFile(i, 1)} disabled={i === pendingFiles.length - 1} className="p-1 hover:bg-accent rounded disabled:opacity-30">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removePendingFile(i)} className="p-1 hover:bg-destructive/20 rounded">
                    <X className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPendingFiles([])}>取消</Button>
              <Button className="flex-1" onClick={confirmMerge}>确认合并</Button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "w-full max-w-lg border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-lg font-medium mb-2">拖拽 TXT 文件到此处</p>
            <p className="text-sm text-muted-foreground mb-4">或点击选择文件（支持多文件）</p>
            <p className="text-xs text-muted-foreground">支持 UTF-8 / GBK 编码，单文件 ≤ 50MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".txt"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleFiles(files);
              }}
            />
          </div>
        )}
      </div>
    );
  }

  const lines = text.split("\n");

  return (
    <div className="h-full flex">
      {/* Chapter sidebar */}
      <div className="w-64 border-r border-border shrink-0 flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{fileName}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {chapters.length} 章 · {lines.length} 行
          </p>
        </div>

        {/* 章节/分集切换 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setShowEpisodes(false)}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs transition-colors",
              !showEpisodes ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            章节
          </button>
          <button
            onClick={() => setShowEpisodes(true)}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs transition-colors",
              showEpisodes ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            分集预览
          </button>
        </div>

        <div className="flex-1 overflow-auto py-1">
          {!showEpisodes ? (
            chapters.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">未识别到章节标记</p>
            ) : (
              chapters.map((ch) => (
                <button
                  key={ch.index}
                  onClick={() => scrollToChapter(ch)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs truncate transition-colors",
                    activeChapter === ch.index
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {ch.title}
                </button>
              ))
            )
          ) : episodeGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">请先上传含章节标记的文件</p>
          ) : (
            episodeGroups.map((eg) => (
              <div key={eg.episode} className="px-3 py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <BookOpen className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium">第 {eg.episode} 集</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{eg.chapters.length} 章</span>
                </div>
                {eg.chapters.map((ch) => (
                  <button
                    key={ch.index}
                    onClick={() => { setShowEpisodes(false); scrollToChapter(ch); }}
                    className="w-full text-left text-[11px] text-muted-foreground truncate py-0.5 hover:text-foreground"
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-border">
          <Button
            className="w-full"
            size="sm"
            onClick={handleRun}
            disabled={running || currentProject?.status === "running"}
          >
            {running ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            开始生成
          </Button>
        </div>
      </div>

      {/* Text preview */}
      <div ref={textRef} className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed">
        {lines.map((line, i) => {
          const isChapterTitle = CHAPTER_RE.test(line);
          return (
            <div
              key={i}
              data-line={i}
              className={cn(
                "py-0.5",
                isChapterTitle && "text-primary font-bold text-base mt-6 mb-2"
              )}
            >
              <span className="inline-block w-12 text-right mr-4 text-muted-foreground/40 text-xs select-none">
                {i + 1}
              </span>
              {line || "\u00A0"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

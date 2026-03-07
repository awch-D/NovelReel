import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { ChevronDown, Loader2, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface LogEntry {
  timestamp: string;
  stage: string;
  message: string;
  level: string;
}

export function StatusBar() {
  const { currentProject, statusBarExpanded, toggleStatusBar } = useProjectStore();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const pid = currentProject?.project_id;
  const isRunning = currentProject?.status === "running";
  const isError = currentProject?.status === "error";
  const isCompleted = currentProject?.status === "completed";

  // Poll logs when expanded and running
  useEffect(() => {
    if (!pid || !statusBarExpanded) return;
    const fetchLogs = () => api.getLogs(pid).then(setLogs).catch(() => {});
    fetchLogs();
    if (isRunning) {
      const timer = setInterval(fetchLogs, 3000);
      return () => clearInterval(timer);
    }
  }, [pid, statusBarExpanded, isRunning]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  if (!currentProject) return null;

  const barColor = isRunning
    ? "bg-primary"
    : isCompleted
    ? "bg-green-500"
    : isError
    ? "bg-destructive"
    : "bg-muted";

  if (!statusBarExpanded) {
    return (
      <div
        className={cn("h-1 cursor-pointer transition-colors", barColor)}
        onDoubleClick={toggleStatusBar}
        title="双击展开状态栏"
      />
    );
  }

  return (
    <div className="border-t border-border bg-card/50 shrink-0">
      <div className="flex items-center justify-between px-4 py-1 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground">任务状态</span>
        <div className="flex items-center gap-2">
          {isCompleted && pid && (
            <Button size="sm" variant="ghost" className="text-xs h-6 px-2" asChild>
              <a href={api.getExportUrl(pid)} download>
                <Download className="w-3 h-3 mr-1" />导出项目
              </a>
            </Button>
          )}
          <button onClick={toggleStatusBar} className="p-0.5 hover:bg-accent rounded">
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          {isRunning && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          <span className="text-sm">
            {isRunning
              ? currentProject.current_step || "运行中..."
              : isCompleted
              ? "全部完成"
              : isError
              ? `错误: ${currentProject.error || "未知错误"}`
              : "就绪"}
          </span>
        </div>
        {isRunning && (
          <div className="flex items-center gap-3">
            <Progress value={currentProject.progress} className="flex-1" />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {Math.round(currentProject.progress)}%
            </span>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div className="max-h-32 overflow-auto rounded bg-muted/30 p-2 space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-muted-foreground/60 shrink-0 w-14">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn(
                  "shrink-0 w-20 truncate",
                  log.level === "error" ? "text-destructive" : "text-muted-foreground"
                )}>
                  [{log.stage}]
                </span>
                <span className={cn(
                  log.level === "error" ? "text-destructive" : "text-foreground/80"
                )}>
                  {log.message}
                </span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

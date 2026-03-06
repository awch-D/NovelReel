import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project";
import { ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function StatusBar() {
  const { currentProject, statusBarExpanded, toggleStatusBar } = useProjectStore();

  if (!currentProject) return null;

  const isRunning = currentProject.status === "running";
  const isError = currentProject.status === "error";
  const isCompleted = currentProject.status === "completed";

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
        <button onClick={toggleStatusBar} className="p-0.5 hover:bg-accent rounded">
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
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
      </div>
    </div>
  );
}

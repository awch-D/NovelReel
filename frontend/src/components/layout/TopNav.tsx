import { useProjectStore } from "@/stores/project";
import { Settings, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function TopNav() {
  const { currentProject, statusBarExpanded } = useProjectStore();
  const navigate = useNavigate();

  const isRunning = currentProject?.status === "running";
  const progress = currentProject?.progress ?? 0;

  return (
    <header className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
      <button
        onClick={() => navigate("/")}
        className="text-sm font-bold tracking-wide text-primary hover:opacity-80 transition-opacity"
      >
        Novel2Toon
      </button>

      {currentProject && (
        <>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm truncate max-w-[200px]">{currentProject.name}</span>

          {currentProject.status === "running" && currentProject.current_step && (
            <span className="text-xs text-muted-foreground ml-2">
              {currentProject.current_step}
            </span>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* Progress ring — visible when status bar is collapsed and pipeline is running */}
      {currentProject && !statusBarExpanded && (
        <div className="relative w-7 h-7 flex items-center justify-center">
          {isRunning ? (
            <>
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="11" fill="none" stroke="hsl(var(--muted))" strokeWidth="2.5" />
                <circle
                  cx="14" cy="14" r="11" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 11}`}
                  strokeDashoffset={`${2 * Math.PI * 11 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute text-[8px] font-medium">{Math.round(progress)}</span>
            </>
          ) : currentProject.status === "completed" ? (
            <div className="w-5 h-5 rounded-full bg-green-500" />
          ) : currentProject.status === "error" ? (
            <div className="w-5 h-5 rounded-full bg-destructive" />
          ) : null}
        </div>
      )}

      {currentProject && (
        <button
          onClick={() => useProjectStore.getState().setActivePanel("settings")}
          className="p-1.5 rounded hover:bg-accent transition-colors"
        >
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </header>
  );
}

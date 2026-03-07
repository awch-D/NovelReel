import { cn } from "@/lib/utils";
import { useProjectStore } from "@/stores/project";
import {
  FileText,
  ClipboardList,
  Palette,
  Image,
  Mic,
  Film,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

export function Sidebar() {
  const { activePanel, setActivePanel, sidebarExpanded, toggleSidebar, currentProject, scriptData } = useProjectStore();

  const hasScript = !!scriptData;
  const isNotCreated = currentProject?.status !== "created";

  const NAV_ITEMS = [
    { id: "novel", label: "小说管理", icon: FileText, disabled: false, tooltip: "" },
    { id: "script", label: "剧本", icon: ClipboardList, disabled: !isNotCreated, tooltip: "需要先上传小说并运行" },
    { id: "assets", label: "资产库", icon: Palette, disabled: !hasScript, tooltip: "需要先生成剧本" },
    { id: "frames", label: "分镜", icon: Image, disabled: !hasScript, tooltip: "需要先生成剧本" },
    { id: "voice", label: "配音", icon: Mic, disabled: !hasScript, tooltip: "需要先生成剧本" },
    { id: "synthesis", label: "合成", icon: Film, disabled: !hasScript, tooltip: "需要先生成剧本" },
    { id: "settings", label: "项目设置", icon: Settings, disabled: false, tooltip: "" },
  ];

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "flex flex-col border-r border-border bg-card/30 shrink-0 transition-all duration-200",
          sidebarExpanded ? "w-[200px]" : "w-16"
        )}
      >
        <nav className="flex-1 py-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePanel === item.id;

            const button = (
              <button
                key={item.id}
                disabled={item.disabled}
                onClick={() => setActivePanel(item.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors relative",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  item.disabled && "opacity-40 cursor-not-allowed"
                )}
              >
                {active && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r" />
                )}
                <Icon className="w-5 h-5 shrink-0" />
                {sidebarExpanded && (
                  <span className="truncate">
                    {item.label}
                  </span>
                )}
              </button>
            );

            if (!sidebarExpanded || (item.disabled && item.tooltip)) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right">
                    {item.disabled && item.tooltip ? item.tooltip : item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return button;
          })}
        </nav>

        <button
          onClick={toggleSidebar}
          className="p-3 border-t border-border text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
        >
          {sidebarExpanded ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
}

import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { useProject } from "@/hooks/useProject";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { NovelPanel } from "./panels/NovelPanel";
import { ScriptPanel } from "./panels/ScriptPanel";
import { AssetsPanel } from "./panels/AssetsPanel";
import { FramesPanel } from "./panels/FramesPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { Loader2 } from "lucide-react";
import type { Episode } from "@/types";

const PANELS: Record<string, React.FC> = {
  novel: NovelPanel,
  script: ScriptPanel,
  assets: AssetsPanel,
  frames: FramesPanel,
  settings: SettingsPanel,
};

export function Workspace() {
  const { id } = useParams<{ id: string }>();
  const { currentProject, setCurrentProject, activePanel, setActivePanel, setScriptData, setCharacters, setSceneAssets, setAnalysis, setOutlines } = useProjectStore();
  useProject();

  // 加载项目状态
  useEffect(() => {
    if (!id) return;

    api.getStatus(id).then((status) => {
      setCurrentProject({
        project_id: id,
        name: status.name,
        status: status.status as "created" | "running" | "completed" | "error",
        current_step: status.current_step,
        progress: status.progress,
        error: status.error,
      });
    }).catch(() => {
      // fallback
    });

    setActivePanel("novel");
    return () => setCurrentProject(null);
  }, [id]);

  // status=completed 时自动加载 script + characters + scenes
  useEffect(() => {
    if (!currentProject || currentProject.status !== "completed") return;
    const pid = currentProject.project_id;

    api.getScript(pid)
      .then((data) => setScriptData(data as Record<string, Episode>))
      .catch(() => {});

    api.getCharacters(pid)
      .then((chars) => setCharacters(chars))
      .catch(() => {});

    api.getSceneAssets(pid)
      .then((scenes) => setSceneAssets(scenes))
      .catch(() => {});

    api.getAnalysis(pid)
      .then((data) => setAnalysis(data))
      .catch(() => {});

    api.getOutlines(pid)
      .then((data) => setOutlines(data))
      .catch(() => {});
  }, [currentProject?.project_id, currentProject?.status]);

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const Panel = PANELS[activePanel];

  return (
    <div className="flex-1 flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto">
          {Panel ? (
            <Panel />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-1">功能开发中</p>
                <p className="text-sm">此面板将在后续版本中开放</p>
              </div>
            </div>
          )}
        </main>
        <StatusBar />
      </div>
    </div>
  );
}

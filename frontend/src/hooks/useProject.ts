import { useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { usePolling } from "./usePolling";

export function useProject() {
  const { currentProject, setCurrentProject, updateProject, settings } = useProjectStore();

  const pollStatus = useCallback(async () => {
    if (!currentProject) return;
    try {
      const status = await api.getStatus(currentProject.project_id);
      updateProject(currentProject.project_id, {
        status: status.status as "created" | "running" | "completed" | "error",
        current_step: status.current_step,
        progress: status.progress,
        error: status.error,
      });
      setCurrentProject({
        ...currentProject,
        status: status.status as "created" | "running" | "completed" | "error",
        current_step: status.current_step,
        progress: status.progress,
        error: status.error,
      });
    } catch {
      // ignore polling errors
    }
  }, [currentProject?.project_id]);

  usePolling(pollStatus, 2000, currentProject?.status === "running");

  const createProject = async (file: File, name: string) => {
    const result = await api.createProject(file, name);
    return {
      project_id: result.project_id,
      name: result.name,
      status: "created" as const,
      current_step: null,
      progress: 0,
      error: null,
    };
  };

  const runPipeline = async () => {
    if (!currentProject) return;
    await api.runPipeline(currentProject.project_id, { ...settings });
    updateProject(currentProject.project_id, { status: "running", progress: 0 });
    setCurrentProject({ ...currentProject, status: "running", progress: 0 });
  };

  return { createProject, runPipeline, pollStatus };
}

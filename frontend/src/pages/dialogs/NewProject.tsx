import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/project";
import { api, saveProjectLocally } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import { useRef } from "react";
import type { Project } from "@/types";

interface NewProjectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProject({ open, onOpenChange }: NewProjectProps) {
  const navigate = useNavigate();
  const { addProject } = useProjectStore();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    if (!file || !name.trim()) return;
    setCreating(true);
    try {
      const result = await api.createProject(file, name.trim());
      const project: Project = {
        project_id: result.project_id,
        name: result.name,
        status: "created",
        current_step: null,
        progress: 0,
        error: null,
      };
      saveProjectLocally({ ...project, status: "created" });
      addProject(project);
      onOpenChange(false);
      setName("");
      setFile(null);
      navigate(`/projects/${result.project_id}`);
    } catch (err) {
      alert("创建失败: " + (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>上传 TXT 小说文件，开始创作漫剧</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">项目名称</label>
            <Input
              placeholder="输入项目名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">小说文件</label>
            <input
              ref={fileRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
            >
              {file ? (
                <span className="text-sm">{file.name}</span>
              ) : (
                <div className="text-muted-foreground">
                  <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">点击选择 TXT 文件</p>
                </div>
              )}
            </button>
          </div>
          <Button className="w-full" disabled={!file || !name.trim() || creating} onClick={handleCreate}>
            {creating ? "创建中..." : "创建项目"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

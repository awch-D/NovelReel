import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectStore } from "@/stores/project";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Upload, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

export function ProjectList() {
  const navigate = useNavigate();
  const { projects, setProjects, addProject, removeProject, updateProject } = useProjectStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Load projects from backend on mount
  useState(() => {
    api.listProjects().then((list) => {
      setProjects(
        list.map((p) => ({
          project_id: p.project_id,
          name: p.name,
          status: (p.status || "created") as Project["status"],
          current_step: null,
          progress: 0,
          error: null,
          created_at: p.created_at,
        }))
      );
    });
  });

  const handleCreate = async () => {
    if (!file || !newName.trim()) return;
    setCreating(true);
    try {
      const result = await api.createProject(file, newName.trim());
      const project: Project = {
        project_id: result.project_id,
        name: result.name,
        status: "created",
        current_step: null,
        progress: 0,
        error: null,
      };
      addProject(project);
      setDialogOpen(false);
      setNewName("");
      setFile(null);
      navigate(`/projects/${result.project_id}`);
    } catch (err) {
      alert("创建失败: " + (err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await api.deleteProject(id);
    removeProject(id);
    setDeleteTarget(null);
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      updateProject(id, { name: editName.trim() });
      // Update localStorage
      const stored = localStorage.getItem("novel2toon_projects");
      if (stored) {
        const list = JSON.parse(stored);
        const updated = list.map((p: { project_id: string }) =>
          p.project_id === id ? { ...p, name: editName.trim() } : p
        );
        localStorage.setItem("novel2toon_projects", JSON.stringify(updated));
      }
    }
    setEditingId(null);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      created: { text: "草稿", color: "bg-muted text-muted-foreground" },
      running: { text: "运行中", color: "bg-primary/20 text-primary" },
      completed: { text: "已完成", color: "bg-green-500/20 text-green-400" },
      error: { text: "错误", color: "bg-destructive/20 text-destructive" },
      failed: { text: "失败", color: "bg-destructive/20 text-destructive" },
    };
    const s = map[status] || map.created;
    return <span className={cn("px-2 py-0.5 rounded text-xs font-medium", s.color)}>{s.text}</span>;
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">我的项目</h1>
            <p className="text-sm text-muted-foreground mt-1">管理你的小说转漫剧项目</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新建项目
          </Button>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <FolderOpen className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg mb-2">还没有项目</p>
            <p className="text-sm mb-6">上传一个 TXT 小说文件开始创作</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              创建第一个项目
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <div
                key={p.project_id}
                className="group border border-border rounded-lg bg-card hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/projects/${p.project_id}`)}
              >
                {/* Cover */}
                <div className="aspect-video bg-muted/30 rounded-t-lg flex items-center justify-center">
                  <FileTextIcon className="w-10 h-10 text-muted-foreground/30" />
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    {editingId === p.project_id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleRename(p.project_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(p.project_id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium bg-transparent border-b border-primary outline-none w-full"
                      />
                    ) : (
                      <h3
                        className="text-sm font-medium truncate"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingId(p.project_id);
                          setEditName(p.name);
                        }}
                      >
                        {p.name}
                      </h3>
                    )}
                    {statusLabel(p.status)}
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-muted-foreground">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : ""}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(p.project_id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
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
            <Button
              className="w-full"
              disabled={!file || !newName.trim() || creating}
              onClick={handleCreate}
            >
              {creating ? "创建中..." : "创建项目"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>删除后无法恢复，确定要删除这个项目吗？</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

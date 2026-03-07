import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/stores/project";
import { cn } from "@/lib/utils";
import { Lock, Unlock, RefreshCw, User, MapPin, Loader2, Check, X, ZoomIn, Images, ChevronLeft, ChevronRight, Upload, Package, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import type { Character, SceneAsset, PropAsset, CharacterView, SceneView, LibraryVersion } from "@/types";
import { CHARACTER_VIEWS, SCENE_VIEWS } from "@/types";

export function AssetsPanel() {
  const { characters, sceneAssets, props, setCharacters, setSceneAssets, setProps, currentProject } = useProjectStore();
  const [tab, setTab] = useState<"characters" | "scenes" | "props">("characters");
  const [preview, setPreview] = useState<{ images: { src: string; label: string }[]; index: number; title: string; description: string } | null>(null);
  const [libraryModal, setLibraryModal] = useState<{ type: string; id: string; name: string } | null>(null);
  const [unlockConfirm, setUnlockConfirm] = useState<{ type: string; id: string; name: string; episodes: string[]; shots: number } | null>(null);
  const projectId = currentProject?.project_id;
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 轮询：当有 generating 状态时定时刷新
  useEffect(() => {
    const hasGenerating = characters.some(c => c.core_views_status === "generating") ||
      sceneAssets.some(s => s.core_views_status === "generating");

    if (hasGenerating && projectId) {
      if (!pollingRef.current) {
        pollingRef.current = setInterval(async () => {
          const [chars, scenes] = await Promise.all([
            api.getCharacters(projectId),
            api.getSceneAssets(projectId),
          ]);
          setCharacters(chars);
          setSceneAssets(scenes);
        }, 3000);
      }
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [characters, sceneAssets, projectId, setCharacters, setSceneAssets]);

  const handleGenerateChar = useCallback(async (id: string) => {
    if (!projectId) return;
    try {
      const { image } = await api.regenerateCharacter(projectId, id);
      setCharacters(
        characters.map((c) =>
          c.id === id
            ? { ...c, candidates: [...(c.candidates || []), image] }
            : c
        )
      );
    } catch (err) {
      toast.error("生成角色失败: " + (err as Error).message);
    }
  }, [projectId, characters, setCharacters]);

  const handleLockChar = useCallback(async (id: string) => {
    const char = characters.find((c) => c.id === id);
    if (char?.locked && projectId) {
      const result = await api.unlockAsset(projectId, "characters", id);
      setUnlockConfirm({ type: "characters", id, name: char.name, episodes: result.affected_episodes, shots: result.affected_shots });
      return;
    }
    setCharacters(characters.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)));
  }, [characters, setCharacters, projectId]);

  const handleSelectCharCandidate = useCallback(async (charId: string, img: string) => {
    if (!projectId) return;
    // 从 URL 中提取文件名
    const filename = img.split("/").pop() || "";
    const { reference_image } = await api.selectAsset(projectId, "characters", charId, filename);
    setCharacters(characters.map((c) =>
      c.id === charId ? { ...c, reference_image: reference_image + `?t=${Date.now()}`, locked: true } : c
    ));
  }, [projectId, characters, setCharacters]);

  const handleGenerateScene = useCallback(async (id: string) => {
    if (!projectId) return;
    try {
      const { image } = await api.regenerateScene(projectId, id);
      setSceneAssets(
        sceneAssets.map((s) =>
          s.id === id
            ? { ...s, candidates: [...(s.candidates || []), image] }
            : s
        )
      );
    } catch (err) {
      toast.error("生成场景失败: " + (err as Error).message);
    }
  }, [projectId, sceneAssets, setSceneAssets]);

  const handleLockScene = useCallback(async (id: string) => {
    const scene = sceneAssets.find((s) => s.id === id);
    if (scene?.locked && projectId) {
      const result = await api.unlockAsset(projectId, "scenes", id);
      setUnlockConfirm({ type: "scenes", id, name: scene.name, episodes: result.affected_episodes, shots: result.affected_shots });
      return;
    }
    setSceneAssets(sceneAssets.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)));
  }, [sceneAssets, setSceneAssets, projectId]);

  const handleSelectSceneCandidate = useCallback(async (sceneId: string, img: string) => {
    if (!projectId) return;
    const filename = img.split("/").pop() || "";
    const { reference_image } = await api.selectAsset(projectId, "scenes", sceneId, filename);
    setSceneAssets(sceneAssets.map((s) =>
      s.id === sceneId ? { ...s, reference_image: reference_image + `?t=${Date.now()}`, locked: true } : s
    ));
  }, [projectId, sceneAssets, setSceneAssets]);

  const handleGenerateAll = async () => {
    if (tab === "characters") {
      for (const c of characters) {
        if (!c.locked) await handleGenerateChar(c.id);
      }
    } else if (tab === "scenes") {
      for (const s of sceneAssets) {
        if (!s.locked) await handleGenerateScene(s.id);
      }
    } else {
      for (const p of props) {
        if (!p.locked) await handleGenerateProp(p.id);
      }
    }
  };

  // Props handlers
  const handleGenerateProp = useCallback(async (id: string) => {
    if (!projectId) return;
    try {
      const { image } = await api.regenerateProp(projectId, id);
      setProps(props.map((p) => p.id === id ? { ...p, candidates: [...(p.candidates || []), image] } : p));
    } catch (err) {
      toast.error("生成道具失败: " + (err as Error).message);
    }
  }, [projectId, props, setProps]);

  const handleLockProp = useCallback(async (id: string) => {
    const prop = props.find((p) => p.id === id);
    if (prop?.locked && projectId) {
      await api.unlockAsset(projectId, "props", id);
      setProps(props.map((p) => (p.id === id ? { ...p, locked: false, reference_image: undefined } : p)));
      return;
    }
    setProps(props.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p)));
  }, [props, setProps, projectId]);

  const handleSelectPropCandidate = useCallback(async (propId: string, img: string) => {
    if (!projectId) return;
    const filename = img.split("/").pop() || "";
    const { reference_image } = await api.selectAsset(projectId, "props", propId, filename);
    setProps(props.map((p) => p.id === propId ? { ...p, reference_image: reference_image + `?t=${Date.now()}`, locked: true } : p));
  }, [projectId, props, setProps]);

  // Upload handler
  const handleUpload = useCallback(async (type: string, id: string, file: File) => {
    if (!projectId) return;
    try {
      const { image } = await api.uploadCandidate(projectId, type, id, file);
      if (type === "characters") {
        setCharacters(characters.map(c => c.id === id ? { ...c, candidates: [...(c.candidates || []), image] } : c));
      } else if (type === "scenes") {
        setSceneAssets(sceneAssets.map(s => s.id === id ? { ...s, candidates: [...(s.candidates || []), image] } : s));
      } else {
        setProps(props.map(p => p.id === id ? { ...p, candidates: [...(p.candidates || []), image] } : p));
      }
    } catch (err) {
      toast.error("上传失败: " + (err as Error).message);
    }
  }, [projectId, characters, sceneAssets, props, setCharacters, setSceneAssets, setProps]);

  const handleGenerateAllCoreViews = async () => {
    if (!projectId) return;
    const items = tab === "characters" ? characters : sceneAssets;
    for (const item of items) {
      if (item.locked && item.reference_image && item.core_views_status !== "generating" && item.core_views_status !== "done") {
        if (tab === "characters") {
          await api.generateCharacterCoreViews(projectId, item.id);
        } else {
          await api.generateSceneCoreViews(projectId, item.id);
        }
      }
    }
    // 刷新列表以获取 generating 状态
    const [chars, scenes] = await Promise.all([
      api.getCharacters(projectId),
      api.getSceneAssets(projectId),
    ]);
    setCharacters(chars);
    setSceneAssets(scenes);
  };

  const handleGenerateCoreViews = useCallback(async (type: "characters" | "scenes", id: string) => {
    if (!projectId) return;
    if (type === "characters") {
      await api.generateCharacterCoreViews(projectId, id);
      setCharacters(characters.map(c => c.id === id ? { ...c, core_views_status: "generating" as const } : c));
    } else {
      await api.generateSceneCoreViews(projectId, id);
      setSceneAssets(sceneAssets.map(s => s.id === id ? { ...s, core_views_status: "generating" as const } : s));
    }
  }, [projectId, characters, sceneAssets, setCharacters, setSceneAssets]);

  const handleLockAll = () => {
    if (tab === "characters") {
      setCharacters(characters.map((c) => ({ ...c, locked: true })));
    } else {
      setSceneAssets(sceneAssets.map((s) => ({ ...s, locked: true })));
    }
  };

  const hasData = tab === "characters" ? characters.length > 0 : tab === "scenes" ? sceneAssets.length > 0 : props.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Tab header */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border">
        <button
          onClick={() => setTab("characters")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            tab === "characters" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          角色
        </button>
        <button
          onClick={() => setTab("scenes")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            tab === "scenes" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          场景
        </button>
        <button
          onClick={() => setTab("props")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-md transition-colors",
            tab === "props" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          道具
        </button>

        <div className="flex-1" />
        {tab !== "props" && (
          <Button size="sm" variant="outline" disabled={!hasData} onClick={handleGenerateAllCoreViews}>
            <Images className="w-3.5 h-3.5 mr-1.5" />
            全部生成核心图
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={!hasData} onClick={handleGenerateAll}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          全部生成
        </Button>
        <Button size="sm" variant="outline" disabled={!hasData} onClick={handleLockAll}>
          <Lock className="w-3.5 h-3.5 mr-1.5" />
          全部锁定
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === "characters" ? (
          characters.length === 0 ? (
            <EmptyState icon={User} text="暂无角色数据" sub="运行剧本生成后将自动提取角色" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {characters.map((char) => (
                <CharacterCard
                  key={char.id}
                  character={char}
                  onGenerate={() => handleGenerateChar(char.id)}
                  onLock={() => handleLockChar(char.id)}
                  onSelectCandidate={(img) => handleSelectCharCandidate(char.id, img)}
                  onUpload={(file) => handleUpload("characters", char.id, file)}
                  onLibrary={() => setLibraryModal({ type: "characters", id: char.id, name: char.name })}
                  onPreview={() => char.reference_image && setPreview({
                    images: [{ src: char.reference_image, label: "参考图" }],
                    index: 0,
                    title: char.name,
                    description: char.appearance || char.description,
                  })}
                  onGenerateCoreViews={() => handleGenerateCoreViews("characters", char.id)}
                  onPreviewView={(viewKey) => {
                    if (!char.views) return;
                    const imgs = CHARACTER_VIEWS
                      .filter(v => char.views?.[v.key])
                      .map(v => ({ src: char.views![v.key]! + `?t=${Date.now()}`, label: v.label }));
                    const idx = imgs.findIndex(img => img.label === CHARACTER_VIEWS.find(v => v.key === viewKey)?.label);
                    setPreview({ images: imgs, index: Math.max(0, idx), title: char.name, description: char.appearance || char.description });
                  }}
                />
              ))}
            </div>
          )
        ) : tab === "scenes" ? (
          sceneAssets.length === 0 ? (
            <EmptyState icon={MapPin} text="暂无场景数据" sub="运行剧本生成后将自动提取场景" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sceneAssets.map((scene) => (
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  onGenerate={() => handleGenerateScene(scene.id)}
                  onLock={() => handleLockScene(scene.id)}
                  onSelectCandidate={(img) => handleSelectSceneCandidate(scene.id, img)}
                  onUpload={(file) => handleUpload("scenes", scene.id, file)}
                  onLibrary={() => setLibraryModal({ type: "scenes", id: scene.id, name: scene.name })}
                  onPreview={() => scene.reference_image && setPreview({
                    images: [{ src: scene.reference_image, label: "参考图" }],
                    index: 0,
                    title: scene.name,
                    description: scene.description,
                  })}
                  onGenerateCoreViews={() => handleGenerateCoreViews("scenes", scene.id)}
                  onPreviewView={(viewKey) => {
                    if (!scene.views) return;
                    const imgs = SCENE_VIEWS
                      .filter(v => scene.views?.[v.key])
                      .map(v => ({ src: scene.views![v.key]! + `?t=${Date.now()}`, label: v.label }));
                    const idx = imgs.findIndex(img => img.label === SCENE_VIEWS.find(v => v.key === viewKey)?.label);
                    setPreview({ images: imgs, index: Math.max(0, idx), title: scene.name, description: scene.description });
                  }}
                />
              ))}
            </div>
          )
        ) : (
          props.length === 0 ? (
            <EmptyState icon={Package} text="暂无道具数据" sub="运行剧本生成后将自动提取道具" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {props.map((prop) => (
                <PropCard
                  key={prop.id}
                  prop={prop}
                  onGenerate={() => handleGenerateProp(prop.id)}
                  onLock={() => handleLockProp(prop.id)}
                  onSelectCandidate={(img) => handleSelectPropCandidate(prop.id, img)}
                  onUpload={(file) => handleUpload("props", prop.id, file)}
                  onLibrary={() => setLibraryModal({ type: "props", id: prop.id, name: prop.name })}
                  onPreview={() => prop.reference_image && setPreview({
                    images: [{ src: prop.reference_image, label: "参考图" }],
                    index: 0,
                    title: prop.name,
                    description: prop.description,
                  })}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Image preview lightbox */}
      {preview && (
        <ImageLightbox
          images={preview.images}
          initialIndex={preview.index}
          title={preview.title}
          description={preview.description}
          onClose={() => setPreview(null)}
        />
      )}

      {libraryModal && projectId && (
        <LibraryModal
          projectId={projectId}
          type={libraryModal.type}
          assetId={libraryModal.id}
          name={libraryModal.name}
          onClose={() => setLibraryModal(null)}
          onActivate={(refImg) => {
            const t = `?t=${Date.now()}`;
            if (libraryModal.type === "characters") {
              setCharacters(characters.map(c => c.id === libraryModal.id ? { ...c, reference_image: refImg + t, locked: true } : c));
            } else if (libraryModal.type === "scenes") {
              setSceneAssets(sceneAssets.map(s => s.id === libraryModal.id ? { ...s, reference_image: refImg + t, locked: true } : s));
            } else {
              setProps(props.map(p => p.id === libraryModal.id ? { ...p, reference_image: refImg + t, locked: true } : p));
            }
          }}
        />
      )}

      {unlockConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setUnlockConfirm(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">确认解锁</h3>
            <p className="text-sm text-muted-foreground">
              解锁「{unlockConfirm.name}」将影响 {unlockConfirm.shots} 个镜头
              {unlockConfirm.episodes.length > 0 && `（${unlockConfirm.episodes.join(", ")}）`}
              ，这些镜头可能需要重新生成。
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setUnlockConfirm(null)}>取消</Button>
              <Button variant="destructive" size="sm" onClick={() => {
                const { type, id } = unlockConfirm;
                if (type === "characters") {
                  setCharacters(characters.map(c => c.id === id ? { ...c, locked: false, reference_image: undefined } : c));
                } else if (type === "scenes") {
                  setSceneAssets(sceneAssets.map(s => s.id === id ? { ...s, locked: false, reference_image: undefined } : s));
                }
                setUnlockConfirm(null);
              }}>确认解锁</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterCard({
  character,
  onGenerate,
  onLock,
  onSelectCandidate,
  onUpload,
  onLibrary,
  onPreview,
  onGenerateCoreViews,
  onPreviewView,
}: {
  character: Character;
  onGenerate: () => Promise<void>;
  onLock: () => void;
  onSelectCandidate: (img: string) => void;
  onUpload: (file: File) => void;
  onLibrary: () => void;
  onPreview: () => void;
  onGenerateCoreViews: () => void;
  onPreviewView: (viewKey: CharacterView) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  };

  const canGenerateCoreViews = character.locked && character.reference_image && character.core_views_status !== "generating";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50 group">
      <div className="aspect-square bg-muted/30 flex items-center justify-center relative cursor-pointer" onClick={onPreview}>
        {character.reference_image ? (
          <>
            <img src={character.reference_image} alt={character.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
            </div>
          </>
        ) : !character.candidates?.length && character.appearance ? (
          <div className="p-3 text-center">
            <User className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground line-clamp-3">{character.appearance}</p>
          </div>
        ) : (
          <User className="w-10 h-10 text-muted-foreground/30" />
        )}
        <div className="absolute top-2 right-2">
          {character.locked ? (
            <Lock className="w-4 h-4 text-green-400" />
          ) : (
            <Unlock className="w-4 h-4 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Core views thumbnails */}
      {(character.core_views_status === "done" || character.core_views_status === "generating") && (
        <div className="flex gap-1 p-2 border-t border-border">
          {CHARACTER_VIEWS.map(v => {
            const src = character.views?.[v.key];
            return (
              <button
                key={v.key}
                onClick={() => src && onPreviewView(v.key)}
                className="flex-1 aspect-square rounded overflow-hidden bg-muted/30 relative"
                title={v.label}
              >
                {src ? (
                  <img src={src + `?t=${Date.now()}`} alt={v.label} className="w-full h-full object-cover" />
                ) : character.core_views_status === "generating" ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/50 text-white leading-4">{v.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Candidates */}
      {character.candidates && character.candidates.length > 0 && (
        <div className="flex gap-1 p-2 border-t border-border overflow-x-auto">
          {character.candidates.map((img, i) => (
            <button
              key={i}
              onClick={() => onSelectCandidate(img)}
              className={cn(
                "w-10 h-10 rounded shrink-0 overflow-hidden border-2 transition-colors",
                character.reference_image === img ? "border-primary" : "border-transparent hover:border-primary/50"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="p-3">
        <p className="text-sm font-medium truncate">{character.name}</p>
        {character.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{character.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleGenerate} disabled={generating || character.locked}>
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : "生成"}
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={onLock}>
            {character.locked ? <><Check className="w-3 h-3 mr-1" />已锁定</> : "锁定"}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={() => uploadRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />上传
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={onLibrary} disabled={!character.locked}>
            <History className="w-3 h-3 mr-1" />版本
          </Button>
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </div>
        {character.locked && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-7 mt-2"
            onClick={onGenerateCoreViews}
            disabled={!canGenerateCoreViews}
          >
            {character.core_views_status === "generating" ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" />生成中...</>
            ) : (
              <><Images className="w-3 h-3 mr-1" />生成核心图</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  onGenerate,
  onLock,
  onSelectCandidate,
  onUpload,
  onLibrary,
  onPreview,
  onGenerateCoreViews,
  onPreviewView,
}: {
  scene: SceneAsset;
  onGenerate: () => Promise<void>;
  onLock: () => void;
  onSelectCandidate: (img: string) => void;
  onUpload: (file: File) => void;
  onLibrary: () => void;
  onPreview: () => void;
  onGenerateCoreViews: () => void;
  onPreviewView: (viewKey: SceneView) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  };

  const canGenerateCoreViews = scene.locked && scene.reference_image && scene.core_views_status !== "generating";

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50 group">
      <div className="aspect-video bg-muted/30 flex items-center justify-center relative cursor-pointer" onClick={onPreview}>
        {scene.reference_image ? (
          <>
            <img src={scene.reference_image} alt={scene.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
            </div>
          </>
        ) : !scene.candidates?.length && scene.description ? (
          <div className="p-3 text-center">
            <MapPin className="w-6 h-6 mx-auto mb-1 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground line-clamp-2">{scene.description}</p>
          </div>
        ) : (
          <MapPin className="w-10 h-10 text-muted-foreground/30" />
        )}
        <div className="absolute top-2 right-2">
          {scene.locked ? (
            <Lock className="w-4 h-4 text-green-400" />
          ) : (
            <Unlock className="w-4 h-4 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {/* Core views thumbnails */}
      {(scene.core_views_status === "done" || scene.core_views_status === "generating") && (
        <div className="flex gap-1 p-2 border-t border-border">
          {SCENE_VIEWS.map(v => {
            const src = scene.views?.[v.key];
            return (
              <button
                key={v.key}
                onClick={() => src && onPreviewView(v.key)}
                className="flex-1 aspect-video rounded overflow-hidden bg-muted/30 relative"
                title={v.label}
              >
                {src ? (
                  <img src={src + `?t=${Date.now()}`} alt={v.label} className="w-full h-full object-cover" />
                ) : scene.core_views_status === "generating" ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                <span className="absolute bottom-0 inset-x-0 text-[9px] text-center bg-black/50 text-white leading-4">{v.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Candidates */}
      {scene.candidates && scene.candidates.length > 0 && (
        <div className="flex gap-1 p-2 border-t border-border overflow-x-auto">
          {scene.candidates.map((img, i) => (
            <button
              key={i}
              onClick={() => onSelectCandidate(img)}
              className={cn(
                "w-14 h-8 rounded shrink-0 overflow-hidden border-2 transition-colors",
                scene.reference_image === img ? "border-primary" : "border-transparent hover:border-primary/50"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="p-3">
        <p className="text-sm font-medium truncate">{scene.name}</p>
        {scene.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{scene.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleGenerate} disabled={generating || scene.locked}>
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : "生成"}
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={onLock}>
            {scene.locked ? <><Check className="w-3 h-3 mr-1" />已锁定</> : "锁定"}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={() => uploadRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />上传
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={onLibrary} disabled={!scene.locked}>
            <History className="w-3 h-3 mr-1" />版本
          </Button>
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </div>
        {scene.locked && scene.reference_image && scene.core_views_status !== "done" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-7 mt-2"
            onClick={onGenerateCoreViews}
            disabled={!canGenerateCoreViews}
          >
            {scene.core_views_status === "generating" ? (
              <><Loader2 className="w-3 h-3 animate-spin mr-1" />生成中...</>
            ) : (
              <><Images className="w-3 h-3 mr-1" />生成核心图</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function PropCard({
  prop,
  onGenerate,
  onLock,
  onSelectCandidate,
  onUpload,
  onLibrary,
  onPreview,
}: {
  prop: PropAsset;
  onGenerate: () => Promise<void>;
  onLock: () => void;
  onSelectCandidate: (img: string) => void;
  onUpload: (file: File) => void;
  onLibrary: () => void;
  onPreview: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try { await onGenerate(); } finally { setGenerating(false); }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card/50 group">
      <div className="aspect-square bg-muted/30 flex items-center justify-center relative cursor-pointer" onClick={onPreview}>
        {prop.reference_image ? (
          <>
            <img src={prop.reference_image} alt={prop.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-80 transition-opacity" />
            </div>
          </>
        ) : (
          <Package className="w-10 h-10 text-muted-foreground/30" />
        )}
        <div className="absolute top-2 right-2">
          {prop.locked ? (
            <Lock className="w-4 h-4 text-green-400" />
          ) : (
            <Unlock className="w-4 h-4 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>

      {prop.candidates && prop.candidates.length > 0 && (
        <div className="flex gap-1 p-2 border-t border-border overflow-x-auto">
          {prop.candidates.map((img, i) => (
            <button
              key={i}
              onClick={() => onSelectCandidate(img)}
              className={cn(
                "w-10 h-10 rounded shrink-0 overflow-hidden border-2 transition-colors",
                prop.reference_image === img ? "border-primary" : "border-transparent hover:border-primary/50"
              )}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="p-3">
        <p className="text-sm font-medium truncate">{prop.name}</p>
        {prop.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{prop.description}</p>}
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={handleGenerate} disabled={generating || prop.locked}>
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : "生成"}
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={onLock}>
            {prop.locked ? <><Check className="w-3 h-3 mr-1" />已锁定</> : "锁定"}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={() => uploadRef.current?.click()}>
            <Upload className="w-3 h-3 mr-1" />上传
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={onLibrary} disabled={!prop.locked}>
            <History className="w-3 h-3 mr-1" />版本
          </Button>
          <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

function LibraryModal({
  projectId,
  type,
  assetId,
  name,
  onClose,
  onActivate,
}: {
  projectId: string;
  type: string;
  assetId: string;
  name: string;
  onClose: () => void;
  onActivate: (refImg: string) => void;
}) {
  const [versions, setVersions] = useState<LibraryVersion[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getLibrary(projectId, type, assetId).then(d => setVersions(d.versions));
  }, [projectId, type, assetId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const v = await api.saveToLibrary(projectId, type, assetId);
      setVersions(prev => [...prev, v]);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (version: string) => {
    const { reference_image } = await api.activateVersion(projectId, type, assetId, version);
    onActivate(reference_image);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-[480px] max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-medium">{name} - 版本库</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无保存的版本</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {versions.map(v => (
                <button
                  key={v.version}
                  onClick={() => handleActivate(v.version)}
                  className="border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                >
                  <img src={v.url} alt={v.version} className="w-full aspect-square object-cover" />
                  <p className="text-xs text-center py-1 text-muted-foreground">{v.version}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-border">
          <Button size="sm" className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
            保存当前版本到库
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImageLightbox({
  images,
  initialIndex = 0,
  title,
  description,
  onClose,
}: {
  images: { src: string; label: string }[];
  initialIndex?: number;
  title: string;
  description: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const current = images[index];
  const hasMultiple = images.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>

      {hasMultiple && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + images.length) % images.length); }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {hasMultiple && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % images.length); }}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.src}
          alt={title}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="text-center px-4">
          <p className="text-white text-base font-medium">
            {title}{hasMultiple && ` - ${current.label}`}
          </p>
          {description && (
            <p className="text-white/60 text-sm mt-1 max-w-xl">{description}</p>
          )}
          {hasMultiple && (
            <p className="text-white/40 text-xs mt-1">{index + 1} / {images.length}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  sub,
}: {
  icon: React.FC<{ className?: string }>;
  text: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
      <Icon className="w-12 h-12 mb-3 opacity-30" />
      <p className="text-lg mb-1">{text}</p>
      <p className="text-sm">{sub}</p>
    </div>
  );
}

import { useState, useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { cn } from "@/lib/utils";
import { Lock, Unlock, RefreshCw, User, MapPin, Loader2, Check, X, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/services/api";
import type { Character, SceneAsset } from "@/types";

export function AssetsPanel() {
  const { characters, sceneAssets, setCharacters, setSceneAssets, currentProject } = useProjectStore();
  const [tab, setTab] = useState<"characters" | "scenes">("characters");
  const [preview, setPreview] = useState<{ src: string; title: string; description: string } | null>(null);
  const projectId = currentProject?.project_id;

  const handleGenerateChar = useCallback(async (id: string) => {
    if (!projectId) return;
    // 标记 generating 状态由 CharacterCard 内部管理
    const { image } = await api.regenerateCharacter(projectId, id);
    setCharacters(
      characters.map((c) =>
        c.id === id
          ? { ...c, candidates: [...(c.candidates || []), image] }
          : c
      )
    );
  }, [projectId, characters, setCharacters]);

  const handleLockChar = useCallback((id: string) => {
    setCharacters(characters.map((c) => (c.id === id ? { ...c, locked: !c.locked } : c)));
  }, [characters, setCharacters]);

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
    const { image } = await api.regenerateScene(projectId, id);
    setSceneAssets(
      sceneAssets.map((s) =>
        s.id === id
          ? { ...s, candidates: [...(s.candidates || []), image] }
          : s
      )
    );
  }, [projectId, sceneAssets, setSceneAssets]);

  const handleLockScene = useCallback((id: string) => {
    setSceneAssets(sceneAssets.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)));
  }, [sceneAssets, setSceneAssets]);

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
    } else {
      for (const s of sceneAssets) {
        if (!s.locked) await handleGenerateScene(s.id);
      }
    }
  };

  const handleLockAll = () => {
    if (tab === "characters") {
      setCharacters(characters.map((c) => ({ ...c, locked: true })));
    } else {
      setSceneAssets(sceneAssets.map((s) => ({ ...s, locked: true })));
    }
  };

  const hasData = tab === "characters" ? characters.length > 0 : sceneAssets.length > 0;

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

        <div className="flex-1" />
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
                  onPreview={() => char.reference_image && setPreview({ src: char.reference_image, title: char.name, description: char.appearance || char.description })}
                />
              ))}
            </div>
          )
        ) : sceneAssets.length === 0 ? (
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
                onPreview={() => scene.reference_image && setPreview({ src: scene.reference_image, title: scene.name, description: scene.description })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Image preview lightbox */}
      {preview && (
        <ImageLightbox
          src={preview.src}
          title={preview.title}
          description={preview.description}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function CharacterCard({
  character,
  onGenerate,
  onLock,
  onSelectCandidate,
  onPreview,
}: {
  character: Character;
  onGenerate: () => Promise<void>;
  onLock: () => void;
  onSelectCandidate: (img: string) => void;
  onPreview: () => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  };

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
      </div>
    </div>
  );
}

function SceneCard({
  scene,
  onGenerate,
  onLock,
  onSelectCandidate,
  onPreview,
}: {
  scene: SceneAsset;
  onGenerate: () => Promise<void>;
  onLock: () => void;
  onSelectCandidate: (img: string) => void;
  onPreview: () => void;
}) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await onGenerate();
    } finally {
      setGenerating(false);
    }
  };

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
      </div>
    </div>
  );
}

function ImageLightbox({
  src,
  title,
  description,
  onClose,
}: {
  src: string;
  title: string;
  description: string;
  onClose: () => void;
}) {
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
      <div
        className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={title}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="text-center px-4">
          <p className="text-white text-base font-medium">{title}</p>
          {description && (
            <p className="text-white/60 text-sm mt-1 max-w-xl">{description}</p>
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

import { cn } from "@/lib/utils";

interface ImageGridProps {
  images: {
    id: string;
    src: string;
    label?: string;
    status?: string;
    selected?: boolean;
  }[];
  onSelect?: (id: string) => void;
  columns?: number;
}

export function ImageGrid({ images, onSelect, columns = 4 }: ImageGridProps) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {images.map((img) => (
        <div
          key={img.id}
          onClick={() => onSelect?.(img.id)}
          className={cn(
            "group relative aspect-[16/9] rounded-lg overflow-hidden border-2 cursor-pointer transition-all",
            img.selected ? "border-primary" : "border-transparent hover:border-primary/50"
          )}
        >
          {img.src ? (
            <img
              src={img.src}
              alt={img.label || ""}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                el.parentElement?.classList.add("bg-muted");
              }}
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
              待生成
            </div>
          )}

          {img.label && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
              <span className="text-xs text-white truncate block">{img.label}</span>
            </div>
          )}

          {img.status && (
            <div
              className={cn(
                "absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium",
                img.status === "generated"
                  ? "bg-green-500/80 text-white"
                  : img.status === "generating"
                  ? "bg-primary/80 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {img.status === "generated" ? "已生成" : img.status === "generating" ? "生成中" : "待生成"}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

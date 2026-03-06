import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Shot } from "@/types";

interface ImagePreviewProps {
  images: { id: string; src: string; label?: string }[];
  shots: Shot[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImagePreview({ images, shots, currentIndex, onClose, onNavigate }: ImagePreviewProps) {
  const current = images[currentIndex];
  const shot = shots[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
    },
    [currentIndex, hasPrev, hasNext, onClose, onNavigate]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <div className="relative max-w-4xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-1 text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <img
            src={current.src}
            alt={current.label || ""}
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          {/* Navigation */}
          {hasPrev && (
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full hover:bg-black/70"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={() => onNavigate(currentIndex + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-full hover:bg-black/70"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="mt-3 text-white/80 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">{current.label}</span>
            <span className="text-xs text-white/50">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
          {shot && (
            <>
              <p className="text-sm">{shot.description}</p>
              {shot.dialogue?.map((d, i) => (
                <p key={i} className="text-xs text-white/60">
                  {d.character}: {d.text}
                </p>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

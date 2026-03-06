import { cn } from "@/lib/utils";

interface EpisodeTabsProps {
  episodes: string[];
  active: string;
  onChange: (ep: string) => void;
}

export function EpisodeTabs({ episodes, active, onChange }: EpisodeTabsProps) {
  if (episodes.length === 0) return null;

  // > 8 episodes: use dropdown
  if (episodes.length > 8) {
    return (
      <select
        value={active}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-transparent px-3 text-sm"
      >
        {episodes.map((ep) => (
          <option key={ep} value={ep}>
            {ep}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex gap-1">
      {episodes.map((ep) => (
        <button
          key={ep}
          onClick={() => onChange(ep)}
          className={cn(
            "px-3 py-1.5 text-xs rounded-md transition-colors",
            active === ep
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          )}
        >
          {ep}
        </button>
      ))}
    </div>
  );
}

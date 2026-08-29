import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LevelStatus {
  level: number;
  cardIds: string[];
  status: "cleared" | "current" | "locked";
}

/** Renders a deck's levels as a row of cleared/current/locked pips. */
export function LevelProgressRow({ levels, size = "md" }: { levels: LevelStatus[]; size?: "sm" | "md" }) {
  if (levels.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {levels.map((lvl, i) => (
        <div key={lvl.level} className="flex items-center gap-1.5">
          <div
            title={`Level ${lvl.level} — ${lvl.cardIds.length} card${lvl.cardIds.length === 1 ? "" : "s"} (${lvl.status})`}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full font-heading font-semibold",
              size === "sm" ? "size-7 text-xs" : "size-9 text-sm",
              lvl.status === "cleared" && "bg-secondary text-secondary-foreground",
              lvl.status === "current" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
              lvl.status === "locked" && "bg-muted text-muted-foreground",
            )}
          >
            {lvl.status === "cleared" ? (
              <Check className="size-4" />
            ) : lvl.status === "locked" ? (
              <Lock className="size-3.5" />
            ) : (
              lvl.level
            )}
          </div>
          {i < levels.length - 1 && <div className="h-0.5 w-4 shrink-0 rounded-full bg-border" />}
        </div>
      ))}
    </div>
  );
}

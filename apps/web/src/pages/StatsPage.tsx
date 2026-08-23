import { LevelProgressRow } from "@/components/LevelProgressRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Flame, type LucideIcon, Target, Trophy } from "lucide-react";

function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string;
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex items-center gap-2.5 space-y-0">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", iconClassName)}>
          <Icon className="size-4" />
        </span>
        <CardTitle className="font-normal text-muted-foreground text-sm">{label}</CardTitle>
      </CardHeader>
      {/* Value stays plain ink, never the icon's accent color: identity lives in the icon. */}
      <CardContent className="font-semibold text-3xl">{value}</CardContent>
    </Card>
  );
}

function SectionHeader({
  icon: Icon,
  iconClassName,
  label,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
}) {
  return (
    <CardHeader className="flex items-center gap-2.5 space-y-0">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", iconClassName)}>
        <Icon className="size-4" />
      </span>
      <CardTitle className="font-normal text-muted-foreground text-sm">{label}</CardTitle>
    </CardHeader>
  );
}

/** Renders the last-14-days review count as a simple bar chart. */
function ReviewActivityChart({
  reviewsByDay,
}: {
  reviewsByDay: Array<{ day: string; count: number }>;
}) {
  const maxCount = Math.max(1, ...reviewsByDay.map((d) => d.count));
  const total = reviewsByDay.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card className="gap-3">
      <SectionHeader
        icon={CalendarClock}
        iconClassName="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
        label={`Last 14 days · ${total} review${total === 1 ? "" : "s"}`}
      />
      <CardContent>
        <div className="flex h-20 items-end gap-1">
          {reviewsByDay.map(({ day, count }) => (
            <div
              key={day}
              title={`${day}: ${count} review${count === 1 ? "" : "s"}`}
              className="min-h-1 flex-1 rounded-t bg-indigo-500/70 dark:bg-indigo-400/70"
              style={{ height: `${Math.max(4, (count / maxCount) * 100)}%` }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Renders one deck's level progress row; renders nothing until it has levels. */
function DeckLevelRow({ deckId, deckName }: { deckId: string; deckName: string }) {
  const levelsQuery = useQuery(trpc.levels.get.queryOptions({ deckId }));
  if (!levelsQuery.data || levelsQuery.data.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-sm">{deckName}</p>
      <LevelProgressRow levels={levelsQuery.data} size="sm" />
    </div>
  );
}

/** The Stats dashboard: due/mastery/streak tiles, the activity chart, and per-deck level rows. */
export function StatsPage() {
  const statsQuery = useQuery(trpc.stats.summary.queryOptions());
  const decksQuery = useQuery(trpc.decks.list.queryOptions());
  const stats = statsQuery.data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-heading font-semibold text-2xl">Stats</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarClock}
          iconClassName="bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300"
          label="Due today"
          value={stats ? String(stats.dueToday) : "—"}
        />
        <StatCard
          icon={Target}
          iconClassName="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
          label="Mastery"
          value={stats?.retentionRate != null ? `${Math.round(stats.retentionRate)}%` : "—"}
        />
        <StatCard
          icon={Flame}
          iconClassName="bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300"
          label="Streak"
          value={stats ? `${stats.streak}d` : "—"}
        />
      </div>

      {stats && <ReviewActivityChart reviewsByDay={stats.reviewsByDay} />}

      {decksQuery.data && decksQuery.data.length > 0 && (
        <Card className="gap-4">
          <SectionHeader
            icon={Trophy}
            iconClassName="bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
            label="Levels by deck"
          />
          <CardContent className="flex flex-col gap-4">
            {decksQuery.data.map((deck) => (
              <DeckLevelRow key={deck.id} deckId={deck.id} deckName={deck.name} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

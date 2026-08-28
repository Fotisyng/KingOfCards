import type { Rating } from "@kingofcards/domain-shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Layers, Lightbulb, PartyPopper, Shuffle, Sparkles, WifiOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { useReviewSession } from "@/hooks/useReviewSession";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const REVIEW_ONBOARDING_KEY = "kingofcards:seen-review-onboarding";

function ReviewOnboarding({ onDismiss }: { onDismiss: () => void }) {
  return (
    <Card className="w-full flex-row items-start gap-3 border-primary/20 bg-primary/5 px-4 py-3">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="flex-1 text-sm">
        Rating recalculates when you'll see this card next — be honest, it's how the algorithm learns your memory. New
        cards unlock 5 at a time: clear the current 5 with Good or Easy to reveal the next batch.
      </p>
      <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Dismiss" onClick={onDismiss}>
        <X />
      </Button>
    </Card>
  );
}

/** Short single-token fronts (a kanji, "H") get a jumbo size; longer fronts get a smaller heading size so they don't overflow. */
function frontSizeClass(source: string): string {
  const trimmed = source.trim();
  return trimmed.length <= 4 && !/\s/.test(trimmed) ? "font-heading text-7xl" : "font-heading text-2xl";
}

const RATING_KEYS: Record<string, Rating> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

const RATING_BUTTONS: Array<{ rating: Rating; label: string; className: string }> = [
  {
    rating: "again",
    label: "Again (1)",
    className: "bg-red-500 text-white hover:bg-red-600",
  },
  {
    rating: "hard",
    label: "Hard (2)",
    className: "bg-amber-500 text-white hover:bg-amber-600",
  },
  {
    rating: "good",
    label: "Good (3)",
    className: "bg-emerald-500 text-white hover:bg-emerald-600",
  },
  {
    rating: "easy",
    label: "Easy (4)",
    className: "bg-sky-500 text-white hover:bg-sky-600",
  },
];

/**
 * Entry point for `/review`: prompts for a deck if none is chosen yet, then renders the session.
 *
 * No `deckId` in the URL makes the user choose instead of silently mixing every deck's due cards
 * together: `"all"` is the explicit opt-in for that mixed mode.
 */
export function ReviewPage() {
  const [searchParams] = useSearchParams();
  const deckIdParam = searchParams.get("deckId");

  if (!deckIdParam) {
    return <DeckPicker />;
  }

  return <ReviewSession deckId={deckIdParam === "all" ? undefined : deckIdParam} />;
}

/** Lets the caller pick which deck (or "All decks") to review. */
function DeckPicker() {
  const decksQuery = useQuery(trpc.decks.list.queryOptions());

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-heading font-semibold text-2xl">Practice</h1>
      <p className="text-muted-foreground">Choose a deck to practice.</p>

      <div className="flex flex-col gap-3">
        <Link to="/review?deckId=all">
          <Card className="flex-row items-center gap-3 border-primary/10 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary-foreground">
              <Shuffle className="size-4" />
            </span>
            <CardTitle className="flex-1 font-heading font-medium">All decks</CardTitle>
          </Card>
        </Link>

        {decksQuery.data?.map((deck) => (
          <Link key={deck.id} to={`/review?deckId=${deck.id}`}>
            <Card className="flex-row items-center gap-3 border-primary/10 px-4 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Layers className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <CardTitle className="truncate font-heading font-medium">{deck.name}</CardTitle>
                {deck.description && <p className="truncate text-muted-foreground text-sm">{deck.description}</p>}
              </div>
              <Badge variant="secondary" className="shrink-0">
                {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
              </Badge>
            </Card>
          </Link>
        ))}
        {decksQuery.data?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Sparkles className="size-8 text-secondary" strokeWidth={1.5} />
            <p>No decks yet — add one from the Decks page first.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** The review session itself: card flip, rating buttons, keyboard shortcuts, and sync status. */
function ReviewSession({ deckId }: { deckId?: string }) {
  const dueQuery = useQuery(trpc.due.list.queryOptions({ deckId }));
  const decksQuery = useQuery(trpc.decks.list.queryOptions());
  const session = useReviewSession(dueQuery.data);
  const deckName = deckId ? decksQuery.data?.find((deck) => deck.id === deckId)?.name : undefined;
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem(REVIEW_ONBOARDING_KEY));

  function dismissOnboarding() {
    localStorage.setItem(REVIEW_ONBOARDING_KEY, "1");
    setShowOnboarding(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        event.preventDefault();
        session.reveal();
        return;
      }
      const rating = RATING_KEYS[event.key];
      if (session.revealed && rating) {
        session.rate(rating);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session.revealed, session.rate, session.reveal]);

  if (dueQuery.isLoading || session.queue === null) {
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 p-6">
      <div className="flex w-full items-center justify-between">
        <Link
          to="/review"
          className="flex items-center gap-1 rounded-full px-2 py-1 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Change deck
        </Link>
        <span className="font-heading font-medium text-sm">{deckName ?? "All decks"}</span>
      </div>

      {showOnboarding && <ReviewOnboarding onDismiss={dismissOnboarding} />}

      <div className="flex items-center gap-2">
        <Badge className="bg-accent text-accent-foreground">{session.queue.length} due</Badge>
        {!session.isOnline && (
          <Badge variant="destructive" className="gap-1">
            <WifiOff className="size-3" /> Offline
          </Badge>
        )}
        {session.pendingSyncCount > 0 && (
          <Badge variant="outline">{session.syncing ? "Syncing…" : `${session.pendingSyncCount} pending sync`}</Badge>
        )}
        {session.syncError === "permanent" && (
          <Badge variant="destructive">Some ratings couldn't be saved and were discarded — try logging in again</Badge>
        )}
        {session.syncError === "transient" && (
          <Badge variant="destructive">Sync failed — will retry automatically</Badge>
        )}
      </div>

      {!session.currentCard ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <PartyPopper className="size-10 text-secondary" strokeWidth={1.5} />
          <h1 className="font-heading font-semibold text-2xl">All caught up</h1>
          <p className="text-muted-foreground">No cards are due for review right now.</p>
        </div>
      ) : (
        <>
          <div className="relative w-full pt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={session.currentCard.id}
                className="relative z-10 w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Fixed h-* (not min-h-*) gives the absolutely-positioned faces' size-full a definite height to resolve against; long content scrolls inside its face. */}
                {/* biome-ignore lint/a11y/useSemanticElements: MarkdownContent can render <a>, invalid in <button>. */}
                <div
                  className="relative h-80 cursor-pointer sm:h-96"
                  style={{ perspective: 1600 }}
                  role="button"
                  tabIndex={0}
                  onClick={() => !session.revealed && session.reveal()}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !session.revealed) {
                      e.preventDefault();
                      session.reveal();
                    }
                  }}
                >
                  <motion.div
                    className="relative size-full"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={{ rotateY: session.revealed ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <Card
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-2xl border-none bg-primary py-12 text-primary-foreground shadow-md"
                      style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                    >
                      <CardContent className="flex flex-col items-center gap-4">
                        <MarkdownContent
                          source={session.currentCard.frontMd}
                          className={frontSizeClass(session.currentCard.frontMd)}
                        />
                      </CardContent>
                      <span className="text-primary-foreground/60 text-xs">Tap or press space to reveal</span>
                    </Card>

                    <Card
                      className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-2xl border-none bg-card py-12 shadow-md"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <CardContent className="flex flex-col items-center gap-4">
                        <MarkdownContent source={session.currentCard.backMd} />
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {!session.revealed ? (
            <Button size="lg" className="rounded-xl px-8" onClick={session.reveal}>
              Show answer (space)
            </Button>
          ) : (
            <div className="grid w-full grid-cols-4 gap-2">
              {RATING_BUTTONS.map(({ rating, label, className }) => (
                <motion.div key={rating} whileTap={{ scale: 0.97 }}>
                  <Button
                    disabled={session.submitting}
                    onClick={() => session.rate(rating)}
                    className={cn("w-full rounded-lg font-medium", className)}
                  >
                    {label}
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

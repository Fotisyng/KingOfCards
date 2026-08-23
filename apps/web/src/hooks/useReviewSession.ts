import type { SyncFailureKind } from "@/lib/offlineQueue";
import { trpcClient } from "@/lib/trpc";
import { useOfflineSync } from "@/lib/useOfflineSync";
import type { DueCard, Rating } from "@kingofcards/domain-shared";
import { useCallback, useEffect, useState } from "react";

export interface ReviewSession {
  queue: DueCard[] | null;
  currentCard: DueCard | undefined;
  revealed: boolean;
  submitting: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  syncing: boolean;
  syncError: SyncFailureKind | null;
  reveal: () => void;
  rate: (rating: Rating) => Promise<void>;
}

/**
 * Drives one review session's local queue, reveal state, and rating submission.
 *
 * Snapshots `dueCards` once and works through the copy locally rather than refetching after every
 * rating, which is what lets the offline path advance without a network round trip.
 */
export function useReviewSession(dueCards: DueCard[] | undefined): ReviewSession {
  const { isOnline, pendingCount, syncing, syncError, enqueue, flush } = useOfflineSync();
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (queue === null && dueCards) {
      setQueue(dueCards);
    }
  }, [queue, dueCards]);

  const currentCard = queue?.[0];

  const rate = useCallback(
    async (rating: Rating) => {
      if (!currentCard || submitting) return;
      setSubmitting(true);
      try {
        if (isOnline) {
          try {
            await trpcClient.reviews.submit.mutate({ cardId: currentCard.id, rating });
          } catch {
            // Network blip even though the browser thinks it's online: don't lose the review.
            // Neither a mount nor a real `online` event is coming (the browser already thinks
            // it's online), so trigger the retry ourselves instead of leaving this unsynced until
            // the user reloads or navigates away and back.
            await enqueue(currentCard.id, rating);
            flush();
          }
        } else {
          await enqueue(currentCard.id, rating);
        }
      } finally {
        setQueue((q) => (q ? q.slice(1) : q));
        setRevealed(false);
        setSubmitting(false);
      }
    },
    [currentCard, submitting, isOnline, enqueue, flush],
  );

  const reveal = useCallback(() => setRevealed(true), []);

  return {
    queue,
    currentCard,
    revealed,
    submitting,
    isOnline,
    pendingSyncCount: pendingCount,
    syncing,
    syncError,
    reveal,
    rate,
  };
}

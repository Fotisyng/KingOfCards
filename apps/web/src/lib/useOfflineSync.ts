import type { Rating } from "@kingofcards/domain-shared";
import { useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useState } from "react";
import { countQueuedReviews, enqueueReview, flushQueuedReviews, type SyncFailureKind } from "@/lib/offlineQueue";
import { trpc, trpcClient } from "@/lib/trpc";

// A queued rating can never succeed on retry once its session is gone (UNAUTHORIZED) or its
// card/deck has since been deleted (NOT_FOUND); everything else (network blips, server hiccups)
// is worth retrying on the next flush.
const PERMANENT_ERROR_CODES = new Set(["UNAUTHORIZED", "NOT_FOUND"]);

/** Classifies a `reviews.submit` failure as worth retrying, or never going to succeed. */
function classifySyncFailure(err: unknown): SyncFailureKind {
  if (isTRPCClientError(err) && PERMANENT_ERROR_CODES.has(err.data?.code as string)) return "permanent";
  return "transient";
}

/** Tracks online/offline state and flushes the queued-review outbox on reconnect or mount. */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<SyncFailureKind | null>(null);

  const refreshPendingCount = useCallback(() => {
    countQueuedReviews().then(setPendingCount);
  }, []);

  const flush = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const { retriedTransient, droppedPermanent } = await flushQueuedReviews(
        (cardId, rating, ratedAt) => trpcClient.reviews.submit.mutate({ cardId, rating, ratedAt }),
        classifySyncFailure,
      );
      // Permanent takes priority: a session that's gone means the rest of this flush's transient
      // retries are moot anyway (they'll all fail UNAUTHORIZED on the next attempt too).
      if (droppedPermanent > 0) setSyncError("permanent");
      else if (retriedTransient > 0) setSyncError("transient");
    } catch {
      setSyncError("transient");
    } finally {
      setSyncing(false);
      refreshPendingCount();
      queryClient.invalidateQueries(trpc.due.pathFilter());
      queryClient.invalidateQueries(trpc.stats.pathFilter());
    }
  }, [refreshPendingCount, queryClient]);

  useEffect(() => {
    refreshPendingCount();
    if (navigator.onLine) {
      flush();
    }

    function onOnline() {
      setIsOnline(true);
      flush();
    }
    function onOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flush, refreshPendingCount]);

  const enqueue = useCallback(
    async (cardId: string, rating: Rating) => {
      await enqueueReview({ cardId, rating, queuedAt: new Date().toISOString() });
      refreshPendingCount();
    },
    [refreshPendingCount],
  );

  return { isOnline, pendingCount, syncing, syncError, enqueue, flush };
}

import type { Rating } from "@kingofcards/domain-shared";
import { type DBSchema, openDB } from "idb";

export interface QueuedReview {
  cardId: string;
  rating: Rating;
  queuedAt: string;
}

interface OfflineQueueSchema extends DBSchema {
  "pending-reviews": {
    key: number;
    value: QueuedReview;
  };
}

const DB_NAME = "kingofcards-offline";
const STORE_NAME = "pending-reviews";

function getDb() {
  return openDB<OfflineQueueSchema>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { autoIncrement: true });
    },
  });
}

/** Appends a rating to the offline outbox. */
export async function enqueueReview(entry: QueuedReview): Promise<void> {
  const db = await getDb();
  await db.add(STORE_NAME, entry);
}

/**
 * Lists every queued rating with its store id.
 *
 * One shared transaction (not separate `getAllKeys`/`getAll` calls) so a concurrent enqueue can't
 * skew them relative to each other.
 */
export async function getQueuedReviews(): Promise<Array<{ id: number; entry: QueuedReview }>> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()]);
  await tx.done;
  return keys.map((id, i) => ({ id, entry: values[i] as QueuedReview }));
}

/** Empties the offline outbox entirely. */
export async function clearQueuedReviews(): Promise<void> {
  const db = await getDb();
  await db.clear(STORE_NAME);
}

/** Removes one queued rating by its store id, once it's been successfully submitted. */
export async function removeQueuedReview(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

/** Counts pending queued ratings, for the "N pending sync" badge. */
export async function countQueuedReviews(): Promise<number> {
  const db = await getDb();
  return db.count(STORE_NAME);
}

/** Whether a flush failure is worth retrying (`"transient"`) or never will succeed (`"permanent"`). */
export type SyncFailureKind = "transient" | "permanent";

export interface FlushResult {
  flushed: number;
  retriedTransient: number;
  droppedPermanent: number;
}

/**
 * Submits every queued rating via `submit`, removing each on success.
 *
 * Submitted oldest-first so a card rated multiple times while offline replays in the order it
 * actually happened: `review_log` is append-only and order-sensitive for scheduling. Once a card's
 * entry transiently fails, every later queued entry for that *same* card is skipped rather than
 * attempted, since submitting a later rating first, then retrying the earlier one on the next
 * flush, would apply them out of order. Entries for other cards are unaffected and keep flushing
 * normally.
 *
 * A failed submission is classified via `classifyFailure`: a transient one (network blip, server
 * hiccup) is skipped, not aborted: it stays queued and retries on the next flush. A permanent one
 * (an expired session, a since-deleted card) is removed instead, since retrying it forever would
 * never succeed, and holding onto it would just keep re-surfacing the same error indefinitely. A
 * permanent failure doesn't block that card's later entries since there's no ordering left to
 * protect: nothing about the failure is going to change on retry.
 */
export async function flushQueuedReviews(
  submit: (cardId: string, rating: Rating, ratedAt: string) => Promise<unknown>,
  classifyFailure: (err: unknown) => SyncFailureKind,
): Promise<FlushResult> {
  const queued = await getQueuedReviews();
  let flushed = 0;
  let retriedTransient = 0;
  let droppedPermanent = 0;
  const blockedCardIds = new Set<string>();
  for (const { id, entry } of queued) {
    if (blockedCardIds.has(entry.cardId)) {
      retriedTransient++;
      continue;
    }
    try {
      await submit(entry.cardId, entry.rating, entry.queuedAt);
      await removeQueuedReview(id);
      flushed++;
    } catch (err) {
      if (classifyFailure(err) === "permanent") {
        await removeQueuedReview(id);
        droppedPermanent++;
      } else {
        retriedTransient++;
        blockedCardIds.add(entry.cardId);
      }
    }
  }
  return { flushed, retriedTransient, droppedPermanent };
}

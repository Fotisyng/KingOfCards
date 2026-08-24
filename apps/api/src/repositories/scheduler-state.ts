import { randomUUID } from "node:crypto";
import type { Rating } from "@kingofcards/domain-shared";
import { daysBetween, type Scheduler, type SchedulerState } from "@kingofcards/scheduler";
import type { Client } from "@libsql/client";

/**
 * Reads a card's saved state for one scheduler algorithm.
 *
 * Generic over `TInternal` so this stays algorithm-agnostic: `internal` is only (de)serialized as
 * an opaque blob, never inspected. Takes the `Scheduler` object itself (not a bare algorithm-id
 * string) so TypeScript can infer `TInternal` at the call site.
 *
 * @returns `null` if the card has never been reviewed under this algorithm.
 */
export async function getSchedulerState<TInternal>(
  db: Client,
  cardId: string,
  scheduler: Scheduler<TInternal>,
): Promise<SchedulerState<TInternal> | null> {
  const rs = await db.execute({
    sql: "SELECT state_json, due_at FROM card_scheduler_state WHERE card_id = ? AND algorithm = ?",
    args: [cardId, scheduler.id],
  });
  const row = rs.rows[0];
  if (!row) {
    return null;
  }
  return {
    internal: JSON.parse(row.state_json as string) as TInternal,
    dueAt: new Date(row.due_at as string),
  };
}

/**
 * Records a rating and upserts the card's next scheduler state, as one atomic batch.
 *
 * `review_log` is append-only: this only ever inserts into it, never updates/deletes.
 * `card_scheduler_state` is upserted per `(card_id, algorithm)` so re-reviewing under a different
 * scheduler doesn't clobber another algorithm's saved state for the same card.
 */
export async function saveReview<TInternal>(
  db: Client,
  params: {
    cardId: string;
    scheduler: Scheduler<TInternal>;
    rating: Rating;
    ratedAt: Date;
    nextState: SchedulerState<TInternal>;
  },
): Promise<void> {
  await db.batch(
    [
      {
        sql: "INSERT INTO review_log (id, card_id, rated_at, rating, algorithm, resulting_interval_days) VALUES (?, ?, ?, ?, ?, ?)",
        args: [
          randomUUID(),
          params.cardId,
          params.ratedAt.toISOString(),
          params.rating,
          params.scheduler.id,
          daysBetween(params.ratedAt, params.nextState.dueAt),
        ],
      },
      {
        sql: `INSERT INTO card_scheduler_state (card_id, algorithm, state_json, due_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT (card_id, algorithm) DO UPDATE SET
                state_json = excluded.state_json,
                due_at = excluded.due_at`,
        args: [
          params.cardId,
          params.scheduler.id,
          JSON.stringify(params.nextState.internal),
          params.nextState.dueAt.toISOString(),
        ],
      },
    ],
    "write",
  );
}

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, StickyNote, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { LevelProgressRow } from "@/components/LevelProgressRow";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

/** One deck's card list: level progress, public/private toggle, and inline card create/edit/delete. */
export function DeckDetailPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const queryClient = useQueryClient();
  const decksQuery = useQuery(trpc.decks.list.queryOptions());
  const cardsQuery = useInfiniteQuery(
    trpc.cards.listByDeck.infiniteQueryOptions(
      { deckId: deckId ?? "" },
      { initialCursor: null, getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );
  const cards = cardsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const levelsQuery = useQuery(trpc.levels.get.queryOptions({ deckId: deckId ?? "" }));
  const [frontMd, setFrontMd] = useState("");
  const [backMd, setBackMd] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editFrontMd, setEditFrontMd] = useState("");
  const [editBackMd, setEditBackMd] = useState("");
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);

  const deck = decksQuery.data?.find((d) => d.id === deckId);

  const invalidateCardQueries = () => {
    queryClient.invalidateQueries(trpc.cards.pathFilter());
    queryClient.invalidateQueries(trpc.due.pathFilter());
    queryClient.invalidateQueries(trpc.levels.pathFilter());
    queryClient.invalidateQueries(trpc.decks.pathFilter());
  };

  const createCard = useMutation(
    trpc.cards.create.mutationOptions({
      onSuccess: () => {
        invalidateCardQueries();
        setFrontMd("");
        setBackMd("");
      },
    }),
  );

  const updateCard = useMutation(
    trpc.cards.update.mutationOptions({
      onSuccess: () => {
        invalidateCardQueries();
        setEditingCardId(null);
      },
    }),
  );

  const deleteCard = useMutation(
    trpc.cards.delete.mutationOptions({
      onSuccess: invalidateCardQueries,
    }),
  );

  const setPublic = useMutation(
    trpc.decks.setPublic.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.decks.pathFilter()),
    }),
  );

  function startEditing(cardId: string, currentFrontMd: string, currentBackMd: string) {
    setEditingCardId(cardId);
    setEditFrontMd(currentFrontMd);
    setEditBackMd(currentBackMd);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading font-semibold text-2xl">{deck?.name ?? "Cards"}</h1>
        {deck && (
          <>
            <Badge variant={deck.isPublic ? "secondary" : "outline"}>{deck.isPublic ? "Public" : "Private"}</Badge>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={setPublic.isPending || !deckId}
              onClick={() => deckId && setPublic.mutate({ deckId, isPublic: !deck.isPublic })}
            >
              {deck.isPublic ? "Make private" : "Make public"}
            </Button>
          </>
        )}
      </div>

      {levelsQuery.data && <LevelProgressRow levels={levelsQuery.data} />}

      <Card className="border-primary/10 bg-card/70">
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (deckId && frontMd.trim() && backMd.trim()) {
                createCard.mutate({ deckId, frontMd, backMd });
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="front">Front (markdown)</Label>
              <Textarea id="front" value={frontMd} onChange={(e) => setFrontMd(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="back">Back (markdown)</Label>
              <Textarea id="back" value={backMd} onChange={(e) => setBackMd(e.target.value)} />
            </div>
            <Button type="submit" disabled={createCard.isPending} className="self-start rounded-full">
              Add card
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {cards.map((card) =>
          editingCardId === card.id ? (
            <Card key={card.id} className="border-primary/10 bg-card/70">
              <CardContent>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editFrontMd.trim() && editBackMd.trim()) {
                      updateCard.mutate({
                        cardId: card.id,
                        frontMd: editFrontMd,
                        backMd: editBackMd,
                      });
                    }
                  }}
                >
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`edit-front-${card.id}`}>Front (markdown)</Label>
                    <Textarea
                      id={`edit-front-${card.id}`}
                      value={editFrontMd}
                      onChange={(e) => setEditFrontMd(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`edit-back-${card.id}`}>Back (markdown)</Label>
                    <Textarea
                      id={`edit-back-${card.id}`}
                      value={editBackMd}
                      onChange={(e) => setEditBackMd(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={updateCard.isPending} className="rounded-full">
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setEditingCardId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card key={card.id} className="border-primary/10">
              <CardHeader className="flex items-start gap-3">
                <CardTitle className="min-w-0 flex-1 font-normal text-base">
                  <MarkdownContent source={card.frontMd} />
                </CardTitle>
                {confirmDeleteCardId === card.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-muted-foreground text-xs">Delete?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="rounded-full"
                      disabled={deleteCard.isPending}
                      onClick={() => deleteCard.mutate({ cardId: card.id })}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setConfirmDeleteCardId(null)}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground"
                      aria-label="Edit card"
                      onClick={() => startEditing(card.id, card.frontMd, card.backMd)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Delete card"
                      onClick={() => setConfirmDeleteCardId(card.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <MarkdownContent source={card.backMd} />
              </CardContent>
            </Card>
          ),
        )}
        {cardsQuery.isSuccess && cards.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <StickyNote className="size-8 text-secondary" strokeWidth={1.5} />
            <p>No cards yet — add one above.</p>
          </div>
        )}
        {cardsQuery.hasNextPage && (
          <Button
            variant="outline"
            className="self-center rounded-full"
            disabled={cardsQuery.isFetchingNextPage}
            onClick={() => cardsQuery.fetchNextPage()}
          >
            {cardsQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}

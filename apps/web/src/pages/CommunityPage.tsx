import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { MarkdownContent } from "@/components/MarkdownContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

/** A public deck's sample cards; renders nothing until the preview query resolves with data. */
function DeckPreview({ deckId }: { deckId: string }) {
  const previewQuery = useQuery(trpc.decks.previewCards.queryOptions({ deckId }));

  if (!previewQuery.data || previewQuery.data.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-border/70 border-t pt-3">
      {previewQuery.data.map((card, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: no id in this deliberately minimal payload; list is static, never reordered.
        <div key={`${card.frontMd}-${i}`} className="rounded-lg bg-muted/50 p-3 text-sm">
          <MarkdownContent source={card.frontMd} className="font-medium" />
          <MarkdownContent source={card.backMd} className="mt-1 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

/** Browses every account's public decks, with preview-before-cloning. */
export function CommunityPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const publicDecksQuery = useInfiniteQuery(
    trpc.decks.listPublic.infiniteQueryOptions(
      {},
      { initialCursor: null, getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );
  const publicDecks = publicDecksQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const [previewDeckId, setPreviewDeckId] = useState<string | null>(null);

  const cloneDeck = useMutation(
    trpc.decks.clone.mutationOptions({
      onSuccess: (deck) => {
        queryClient.invalidateQueries(trpc.decks.pathFilter());
        navigate(`/decks/${deck.id}`);
      },
    }),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="font-heading font-semibold text-2xl">Community</h1>
        <p className="text-muted-foreground text-sm">
          Decks other people have made public. Cloning makes your own independent copy — your progress never affects
          theirs, and theirs never affects yours.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {publicDecks.map((deck) => (
          <Card
            key={deck.id}
            className="gap-3 border-primary/10 px-4 py-4 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                  <Globe className="size-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate font-heading font-medium">{deck.name}</CardTitle>
                  {deck.description && <p className="truncate text-muted-foreground text-sm">{deck.description}</p>}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
              </Badge>
              {deck.isOwn ? (
                <Badge variant="outline" className="shrink-0">
                  Yours
                </Badge>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 rounded-full"
                    onClick={() => setPreviewDeckId((id) => (id === deck.id ? null : deck.id))}
                  >
                    {previewDeckId === deck.id ? "Hide preview" : "Preview"}
                  </Button>
                  <Button
                    size="sm"
                    className="shrink-0 rounded-full"
                    disabled={cloneDeck.isPending}
                    onClick={() => cloneDeck.mutate({ deckId: deck.id })}
                  >
                    Clone
                  </Button>
                </>
              )}
            </div>
            {previewDeckId === deck.id && <DeckPreview deckId={deck.id} />}
          </Card>
        ))}
        {publicDecksQuery.isSuccess && publicDecks.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Users className="size-8 text-secondary" strokeWidth={1.5} />
            <p>No public decks yet — make one of yours public from its deck page.</p>
          </div>
        )}
        {cloneDeck.isError && <p className="text-destructive text-sm">Couldn't clone that deck — try again.</p>}
        {publicDecksQuery.hasNextPage && (
          <Button
            variant="outline"
            className="self-center rounded-full"
            disabled={publicDecksQuery.isFetchingNextPage}
            onClick={() => publicDecksQuery.fetchNextPage()}
          >
            {publicDecksQuery.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}

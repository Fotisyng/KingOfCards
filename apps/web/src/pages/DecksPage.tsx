import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

/** Lists the caller's decks, with inline create and delete-with-confirm. */
export function DecksPage() {
  const queryClient = useQueryClient();
  const decksQuery = useQuery(trpc.decks.list.queryOptions());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const createDeck = useMutation(
    trpc.decks.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.decks.pathFilter());
        setName("");
        setDescription("");
      },
    }),
  );

  const deleteDeck = useMutation(
    trpc.decks.delete.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.decks.pathFilter()),
    }),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="font-heading font-semibold text-2xl">Decks</h1>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            createDeck.mutate({ name: name.trim(), description: description.trim() || undefined });
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deck-name">Name</Label>
          <div className="flex gap-2">
            <Input
              id="deck-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New deck name"
              className="rounded-full"
            />
            <Button type="submit" disabled={createDeck.isPending} className="shrink-0 rounded-full">
              Add deck
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deck-description">Description (optional)</Label>
          <Textarea
            id="deck-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="min-h-16 rounded-2xl"
          />
        </div>
        {createDeck.isError && <p className="text-destructive text-sm">Couldn't create the deck — try again.</p>}
      </form>

      <div className="flex flex-col gap-3">
        {decksQuery.data?.map((deck) => (
          <Card
            key={deck.id}
            className="flex-row items-center gap-4 border-primary/10 px-4 py-4 transition-all hover:border-primary/30 hover:shadow-md"
          >
            <Link
              to={`/decks/${deck.id}`}
              className="flex min-w-0 flex-1 items-center gap-3 transition-transform hover:-translate-y-0.5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Layers className="size-4" />
              </span>
              <div className="min-w-0">
                <CardTitle className="truncate font-heading font-medium">{deck.name}</CardTitle>
                {deck.description && <p className="truncate text-muted-foreground text-sm">{deck.description}</p>}
              </div>
            </Link>
            <Badge variant="secondary" className="shrink-0">
              {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
            </Badge>
            <Link
              to={`/review?deckId=${deck.id}`}
              className="shrink-0 rounded-full bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/80"
            >
              Review
            </Link>
            {confirmDeleteId === deck.id ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-muted-foreground text-xs">Delete?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  disabled={deleteDeck.isPending}
                  onClick={() => deleteDeck.mutate({ deckId: deck.id })}
                >
                  Yes
                </Button>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setConfirmDeleteId(null)}>
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                aria-label={`Delete ${deck.name}`}
                onClick={() => setConfirmDeleteId(deck.id)}
              >
                <Trash2 />
              </Button>
            )}
          </Card>
        ))}
        {decksQuery.data?.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Sparkles className="size-8 text-secondary" strokeWidth={1.5} />
            <p>No decks yet — add one above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

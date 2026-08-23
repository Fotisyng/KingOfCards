import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 p-6 text-center">
      <h1 className="font-heading font-semibold text-2xl">Page not found</h1>
      <p className="text-muted-foreground">That page doesn't exist.</p>
      <Link to="/" className="text-primary underline">
        Go to your decks
      </Link>
    </div>
  );
}

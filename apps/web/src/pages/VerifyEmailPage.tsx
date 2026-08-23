import { trpc, trpcClient } from "@/lib/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

type VerifyStatus = "pending" | "success" | "error";

/**
 * Consumes the `?token=` verify-email link on mount and reports the result.
 *
 * `attempted` guards against StrictMode's double-invoked effect: the token is single-use (deleted
 * on consume), so a second call would fail even though the first one already succeeded. Uses a
 * plain promise + local state rather than `useMutation`'s reactive status, since under StrictMode
 * that can settle in the gap between the hook's own subscribe/unsubscribe and never flip
 * `isSuccess`/`isError`.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<VerifyStatus>("pending");
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    trpcClient.auth.verifyEmail
      .mutate({ token })
      .then(() => {
        queryClient.invalidateQueries(trpc.auth.pathFilter());
        setStatus("success");
      })
      .catch(() => setStatus("error"));
  }, [token, queryClient]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 p-6 text-center">
      <h1 className="font-heading font-semibold text-2xl">Verify your email</h1>
      {!token && <p className="text-muted-foreground">That verification link is missing a token.</p>}
      {token && status === "pending" && <p className="text-muted-foreground">Verifying…</p>}
      {token && status === "success" && (
        <>
          <p>Your email is verified.</p>
          <Link to="/" className="text-primary underline">
            Go to your decks
          </Link>
        </>
      )}
      {token && status === "error" && (
        <>
          <p className="text-destructive text-sm">That verification link is invalid or expired.</p>
          <Link to="/verify-email-reminder" className="text-primary underline">
            Request a new link
          </Link>
        </>
      )}
    </div>
  );
}

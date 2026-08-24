import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { trpc } from "@/lib/trpc";

/** Shown to a logged-in but unverified account; lets them re-send the verification email. */
export function VerifyEmailReminderPage() {
  const { user } = useAuth();
  const resend = useMutation(trpc.auth.resendVerification.mutationOptions());

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 p-6 text-center">
      <h1 className="font-heading font-semibold text-2xl">Verify your email</h1>
      <p className="text-muted-foreground">
        We sent a verification link to <strong className="text-foreground">{user?.email}</strong>. Click it to unlock
        your decks.
      </p>
      <Button
        variant="secondary"
        className="rounded-full"
        disabled={resend.isPending || resend.isSuccess}
        onClick={() => resend.mutate()}
      >
        {resend.isSuccess ? "Sent!" : "Resend verification email"}
      </Button>
    </div>
  );
}

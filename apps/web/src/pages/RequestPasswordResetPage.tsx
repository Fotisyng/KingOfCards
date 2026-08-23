import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

/** Lets a signed-out visitor request a password-reset email. */
export function RequestPasswordResetPage() {
  const [email, setEmail] = useState("");
  const request = useMutation(trpc.auth.requestPasswordReset.mutationOptions());

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="font-heading font-semibold text-2xl">Reset your password</h1>
      <Card className="border-primary/10 bg-card/70">
        <CardContent>
          {request.isSuccess ? (
            <p className="text-muted-foreground">If that email has an account, a reset link is on its way.</p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) request.mutate({ email: email.trim() });
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" disabled={request.isPending} className="rounded-full">
                Send reset link
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

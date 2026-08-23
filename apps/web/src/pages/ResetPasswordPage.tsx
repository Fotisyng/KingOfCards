import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";

/** Consumes the `?token=` reset-password link and lets the caller set a new password. */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");

  const reset = useMutation(trpc.auth.resetPassword.mutationOptions());

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="font-heading font-semibold text-2xl">Choose a new password</h1>
      <Card className="border-primary/10 bg-card/70">
        <CardContent>
          {!token ? (
            <p className="text-muted-foreground">That reset link is missing a token.</p>
          ) : reset.isSuccess ? (
            <p className="text-muted-foreground">
              Password updated —{" "}
              <Link to="/login" className="text-primary underline">
                log in
              </Link>
              .
            </p>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (newPassword) reset.mutate({ token, newPassword });
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={reset.isPending} className="rounded-full">
                Update password
              </Button>
              {reset.isError && <p className="text-destructive text-sm">That reset link is invalid or expired.</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

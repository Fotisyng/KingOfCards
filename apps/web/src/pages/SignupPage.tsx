import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

/**
 * The signup form.
 *
 * Seeds the auth cache directly with `setQueryData` on success instead of calling
 * `invalidateQueries`, which only schedules a refetch: navigating immediately after would still
 * read a stale logged-out value and cause `RequireAuth` to bounce back to `/login`.
 */
export function SignupPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signup = useMutation(
    trpc.auth.signup.mutationOptions({
      onSuccess: (user) => {
        queryClient.setQueryData(trpc.auth.me.queryKey(), user);
        navigate("/");
      },
    }),
  );

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="font-heading font-semibold text-2xl">Sign up</h1>
      <Card className="border-primary/10 bg-card/70">
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim() && password) {
                signup.mutate({ email: email.trim(), password });
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">At least 8 characters.</p>
            </div>
            <Button type="submit" disabled={signup.isPending} className="rounded-full">
              Create account
            </Button>
            {signup.isError && (
              <p className="text-destructive text-sm">
                {signup.error.message || "Couldn't create your account — try again."}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
      <p className="text-center text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link to="/login" className="text-primary underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

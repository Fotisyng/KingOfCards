import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

/**
 * The login form.
 *
 * Seeds the auth cache directly with `setQueryData` on success instead of calling
 * `invalidateQueries`, which only schedules a refetch: navigating immediately after would still
 * read the stale logged-out value and cause `RequireAuth` to bounce back to `/login`.
 */
export function LoginPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: (user) => {
        queryClient.setQueryData(trpc.auth.me.queryKey(), user);
        navigate("/");
      },
    }),
  );

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 p-6">
      <h1 className="font-heading font-semibold text-2xl">Log in</h1>
      <Card className="border-primary/10 bg-card/70">
        <CardContent>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim() && password) {
                login.mutate({ email: email.trim(), password });
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={login.isPending} className="rounded-full">
              Log in
            </Button>
            {login.isError && (
              <p className="text-destructive text-sm">{login.error.message || "Invalid email or password."}</p>
            )}
          </form>
        </CardContent>
      </Card>
      <p className="flex justify-between text-muted-foreground text-sm">
        <Link to="/signup" className="text-primary underline">
          Create an account
        </Link>
        <Link to="/request-password-reset" className="text-primary underline">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}

import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "@/lib/auth";

/**
 * Gates `children` behind a logged-in, verified session; redirects otherwise.
 *
 * Blocking verification, per the confirmed scope: logged in but unverified can't reach app data.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.emailVerified) return <Navigate to="/verify-email-reminder" replace />;

  return <>{children}</>;
}

import { trpc } from "@/lib/trpc";
import type { User } from "@kingofcards/domain-shared";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext } from "react";

interface AuthContextValue {
  user: User | null | undefined; // undefined while the initial auth.me check is in flight
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Provides the current session's user (or `null`/`undefined` while loading) to `useAuth`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const meQuery = useQuery(trpc.auth.me.queryOptions());
  return (
    <AuthContext.Provider value={{ user: meQuery.data, isLoading: meQuery.isLoading }}>{children}</AuthContext.Provider>
  );
}

/**
 * Reads the current auth session.
 *
 * @throws {@link Error} If called outside an `AuthProvider`.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

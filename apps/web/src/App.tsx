import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, Menu, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { clearQueuedReviews } from "@/lib/offlineQueue";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const CommunityPage = lazy(() => import("@/pages/CommunityPage").then((m) => ({ default: m.CommunityPage })));
const DeckDetailPage = lazy(() => import("@/pages/DeckDetailPage").then((m) => ({ default: m.DeckDetailPage })));
const DecksPage = lazy(() => import("@/pages/DecksPage").then((m) => ({ default: m.DecksPage })));
const LoginPage = lazy(() => import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const RequestPasswordResetPage = lazy(() =>
  import("@/pages/RequestPasswordResetPage").then((m) => ({
    default: m.RequestPasswordResetPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import("@/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })),
);
const ReviewPage = lazy(() => import("@/pages/ReviewPage").then((m) => ({ default: m.ReviewPage })));
const SignupPage = lazy(() => import("@/pages/SignupPage").then((m) => ({ default: m.SignupPage })));
const StatsPage = lazy(() => import("@/pages/StatsPage").then((m) => ({ default: m.StatsPage })));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })));
const VerifyEmailReminderPage = lazy(() =>
  import("@/pages/VerifyEmailReminderPage").then((m) => ({
    default: m.VerifyEmailReminderPage,
  })),
);

const NAV_LINKS = [
  { to: "/", label: "Decks" },
  { to: "/review", label: "Practice" },
  { to: "/stats", label: "Stats" },
  { to: "/community", label: "Community" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-3 py-1.5 font-medium text-sm transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );

/** Top-level shell: nav bar, auth-aware menu, and the route table. */
function App() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.auth.pathFilter());
        // Also clears the offline outbox, so queued ratings don't replay under a different account on a shared device.
        clearQueuedReviews();
        setMenuOpen(false);
        navigate("/login");
      },
    }),
  );

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-10 border-border/70 border-b bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-1 px-4 py-3 sm:gap-2 sm:px-6">
          <NavLink
            to="/"
            className="mr-2 flex items-center gap-1.5 font-heading font-semibold text-lg text-primary sm:mr-6"
            end
          >
            <Crown className="size-5" strokeWidth={2.25} />
            KingOfCards
          </NavLink>
          {user && (
            <div className="hidden items-center gap-1 sm:flex sm:gap-2">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.to === "/"} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!isLoading &&
              (user ? (
                <>
                  <span className="hidden text-muted-foreground text-sm sm:inline">{user.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex"
                    disabled={logout.isPending}
                    onClick={() => logout.mutate()}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <NavLink to="/login" className={navLinkClass}>
                    Log in
                  </NavLink>
                  <NavLink to="/signup" className={navLinkClass}>
                    Sign up
                  </NavLink>
                </div>
              ))}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <div className="flex flex-col gap-1 border-border/70 border-t px-4 py-3 sm:hidden">
            {user &&
              NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={navLinkClass}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
              ))}
            {!isLoading &&
              (user ? (
                <>
                  <span className="px-3 py-1.5 text-muted-foreground text-sm">{user.email}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    disabled={logout.isPending}
                    onClick={() => logout.mutate()}
                  >
                    Log out
                  </Button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                    Log in
                  </NavLink>
                  <NavLink to="/signup" className={navLinkClass} onClick={() => setMenuOpen(false)}>
                    Sign up
                  </NavLink>
                </>
              ))}
          </div>
        )}
      </nav>
      <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading…</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/verify-email-reminder" element={<VerifyEmailReminderPage />} />
          <Route path="/request-password-reset" element={<RequestPasswordResetPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <DecksPage />
              </RequireAuth>
            }
          />
          <Route
            path="/decks/:deckId"
            element={
              <RequireAuth>
                <DeckDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/review"
            element={
              <RequireAuth>
                <ReviewPage />
              </RequireAuth>
            }
          />
          <Route
            path="/stats"
            element={
              <RequireAuth>
                <StatsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/community"
            element={
              <RequireAuth>
                <CommunityPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;

"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearAllLoginProtectionBrowserState, GOOGLE_POST_LOGIN_REDIRECT_STORAGE_KEY, useAuth } from "@/lib/auth";
import { TURNSTILE_ENABLED, validateTurnstileToken, verifyTurnstileToken } from "@/lib/form-safety";
import { AppUser } from "@/types";

const REGISTER_PASSWORD_HELPER_TEXT = "Password must be at least 8 characters and include uppercase, lowercase, and a number.";
const DEALER_ACCOUNT_NOTE = "Dealer accounts require manual verification before activation.";
const DEALER_ACCOUNT_TIMELINE_NOTE = "Verification usually takes 7–14 days after required documents are submitted.";

function getRegisterPasswordError(password: string) {
  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least 1 uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least 1 lowercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include at least 1 number.";
  }

  return "";
}

function normalizeRedirectPath(value: string | null) {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return null;
  }

  try {
    if (typeof window !== "undefined") {
      const nextUrl = new URL(value, window.location.origin);
      return nextUrl.origin === window.location.origin
        ? `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
        : null;
    }
  } catch {
    return null;
  }

  return value;
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { appUser, loading: authLoading, login, register, continueWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [accountType, setAccountType] = useState<"private" | "dealer">("private");

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      clearAllLoginProtectionBrowserState();
    }
  }, [searchParams]);

  useEffect(() => {
    if (mode !== "register") return;
    setAccountType(searchParams.get("accountType") === "dealer" ? "dealer" : "private");
  }, [mode, searchParams]);

  function navigateToDestination(destination: string, forceWindowFallback = false) {
    router.replace(destination);
    router.refresh();

    if (forceWindowFallback && typeof window !== "undefined") {
      window.setTimeout(() => {
        if (window.location.pathname === destination) return;
        window.location.assign(destination);
      }, 300);
    }
  }

  function resolveDestination(user: Pick<AppUser, "role" | "dealerStatus" | "accountType">, flow: "login" | "register") {
    const redirect = normalizeRedirectPath(searchParams.get("redirect"));
    const isDealerIntent = user.role === "dealer" || user.accountType === "dealer";

    if (redirect) {
      if (redirect.startsWith("/admin") && user.role !== "admin" && user.role !== "super_admin") {
        return user.role === "dealer" ? (user.dealerStatus === "approved" ? "/dealer/dashboard" : "/dealer/application-status") : "/inventory";
      }

      return redirect;
    }

    if (user.role === "admin" || user.role === "super_admin") return "/admin";
    if (isDealerIntent) {
      if (flow === "register") return "/dealer/apply";
      return user.role === "dealer" && user.dealerStatus === "approved"
        ? "/dealer/dashboard"
        : user.dealerStatus === "none"
          ? "/dealer/apply"
          : "/dealer/application-status";
    }

    return "/inventory";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    let navigationStarted = false;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    try {
      if (!email) {
        throw new Error("Please enter your email address.");
      }

      if (!password) {
        throw new Error("Please enter your password.");
      }

      if (mode === "register") {
        if (!name) {
          throw new Error("Please enter your full name.");
        }

        const passwordError = getRegisterPasswordError(password);
        if (passwordError) {
          throw new Error(passwordError);
        }

        const turnstilePresenceError = validateTurnstileToken(turnstileToken);
        if (turnstilePresenceError) {
          throw new Error(turnstilePresenceError);
        }

        const turnstileVerificationError = await verifyTurnstileToken(turnstileToken);
        if (turnstileVerificationError) {
          throw new Error(turnstileVerificationError);
        }
      }

      if (mode === "login") {
        const user = await login(email, password);
        setSuccess("Signed in successfully. Redirecting...");
        navigationStarted = true;
        navigateToDestination(resolveDestination(user, "login"), true);
      } else {
        await register({
          name,
          email,
          password,
          accountType
        });
        setSuccess("Account created successfully. Redirecting...");
        navigationStarted = true;
        navigateToDestination("/", true);
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed");
    } finally {
      if (!navigationStarted) {
        setLoading(false);
      }
    }
  }

  async function handleGoogleContinue() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(GOOGLE_POST_LOGIN_REDIRECT_STORAGE_KEY, "/inventory");
      }
      const user = await continueWithGoogle(accountType);
      if (!user) {
        setSuccess("Redirecting to Google...");
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(GOOGLE_POST_LOGIN_REDIRECT_STORAGE_KEY);
      }
      setSuccess(mode === "login" ? "Signed in successfully. Redirecting..." : "Account created successfully. Redirecting...");
      navigateToDestination("/inventory", true);
    } catch (submissionError) {
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(GOOGLE_POST_LOGIN_REDIRECT_STORAGE_KEY);
      }
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loading || authLoading || !appUser) return;
    if (typeof window !== "undefined") {
      const googleRedirectDestination = window.sessionStorage.getItem(GOOGLE_POST_LOGIN_REDIRECT_STORAGE_KEY);
      if (googleRedirectDestination) {
        window.sessionStorage.removeItem(GOOGLE_POST_LOGIN_REDIRECT_STORAGE_KEY);
        navigateToDestination("/inventory", true);
        return;
      }
    }
    navigateToDestination(resolveDestination(appUser, mode));
  }, [appUser, authLoading, loading, mode]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
      {mode === "register" ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-ink">Account type</p>
          <div className="grid grid-cols-2 gap-2 rounded-[24px] bg-shell p-1">
            <button
              type="button"
              onClick={() => setAccountType("private")}
              className={`rounded-[20px] px-4 py-3 text-sm font-medium transition ${
                accountType === "private" ? "bg-white text-ink shadow-sm" : "text-ink/65 hover:text-ink"
              }`}
            >
              Private account
            </button>
            <button
              type="button"
              onClick={() => setAccountType("dealer")}
              className={`rounded-[20px] px-4 py-3 text-sm font-medium transition ${
                accountType === "dealer" ? "bg-white text-ink shadow-sm" : "text-ink/65 hover:text-ink"
              }`}
            >
              Dealer account
            </button>
          </div>
          {accountType === "dealer" ? (
            <div className="rounded-[22px] border border-black/5 bg-shell px-4 py-3 text-sm leading-6 text-ink/65">
              <p>{DEALER_ACCOUNT_NOTE}</p>
              <p className="mt-1">{DEALER_ACCOUNT_TIMELINE_NOTE}</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {mode === "register" && <Input name="name" placeholder="Full name" required />}
      <Input type="email" name="email" placeholder="Email address" required />
      <Input
        type="password"
        name="password"
        placeholder="Password"
        minLength={mode === "register" ? 8 : 6}
        required
      />
      {mode === "register" ? <p className="text-sm leading-6 text-ink/60">{REGISTER_PASSWORD_HELPER_TEXT}</p> : null}
      {mode === "register" && TURNSTILE_ENABLED ? (
        <TurnstileField
          token={turnstileToken}
          onTokenChange={setTurnstileToken}
          helperText="Complete the security check to finish creating your account."
        />
      ) : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" className="w-full bg-white text-ink border border-black/10 hover:bg-shell" disabled={loading} onClick={() => void handleGoogleContinue()}>
        {loading ? "Please wait..." : "Continue with Google"}
      </Button>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-ink/35">
        <span className="h-px flex-1 bg-black/10" />
        <span>Email</span>
        <span className="h-px flex-1 bg-black/10" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

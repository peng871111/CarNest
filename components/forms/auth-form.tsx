"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearAllLoginProtectionBrowserState, useAuth } from "@/lib/auth";
import { TURNSTILE_ENABLED, validateTurnstileToken, verifyTurnstileToken } from "@/lib/form-safety";
import { AppUser, UserRole } from "@/types";

const DEFAULT_PRIVATE_SIGNUP_ROLE = "seller" as const;
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

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
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

  function navigateToDestination(destination: string) {
    if (typeof window !== "undefined") {
      window.location.assign(destination);
      return;
    }

    router.replace(destination);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    const redirect = searchParams.get("redirect");
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    function resolveDestination(user: Pick<AppUser, "role" | "dealerStatus">, flow: "login" | "register") {
      if (user.role === "admin" || user.role === "super_admin") return "/admin/vehicles";
      if (user.role === "dealer") {
        if (flow === "register") return "/dealer/apply";
        if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;
        return user.dealerStatus === "approved"
          ? "/dealer/dashboard"
          : user.dealerStatus === "none"
            ? "/dealer/apply"
            : "/dealer/application-status";
      }

      if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;
      return "/seller/vehicles";
    }

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
        navigateToDestination(resolveDestination(user, "login"));
      } else {
        const selectedRole: UserRole = accountType === "dealer" ? "dealer" : DEFAULT_PRIVATE_SIGNUP_ROLE;
        const user = await register({
          name,
          email,
          password,
          role: selectedRole
        });
        setSuccess("Account created successfully. Redirecting...");
        navigateToDestination(resolveDestination(user, "register"));
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

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
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearAllLoginProtectionBrowserState, useAuth } from "@/lib/auth";
import { TURNSTILE_ENABLED, validateTurnstileToken, verifyTurnstileToken } from "@/lib/form-safety";
import { UserRole } from "@/types";

const DEFAULT_PUBLIC_SIGNUP_ROLE = "buyer" as const;
const REGISTER_PASSWORD_HELPER_TEXT = "Password must be at least 8 characters and include uppercase, lowercase, and a number.";

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

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      clearAllLoginProtectionBrowserState();
    }
  }, [searchParams]);

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

    function resolveDestination(role: UserRole) {
      if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;
      if (role === "admin" || role === "super_admin") return "/admin/vehicles";
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
        navigateToDestination(resolveDestination(user.role));
      } else {
        const user = await register({
          name,
          email,
          password,
          role: DEFAULT_PUBLIC_SIGNUP_ROLE
        });
        setSuccess("Account created successfully. Redirecting...");
        navigateToDestination(resolveDestination(user.role));
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
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

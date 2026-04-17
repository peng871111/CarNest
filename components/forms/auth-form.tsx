"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TurnstileField } from "@/components/forms/turnstile-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { TURNSTILE_ENABLED, validateTurnstileToken, verifyTurnstileToken } from "@/lib/form-safety";
import { ROLE_PLACEHOLDERS } from "@/lib/roles";
import { UserRole } from "@/types";

type PublicRegistrationRole = "buyer" | "seller";
const DEFAULT_PUBLIC_SIGNUP_ROLE: PublicRegistrationRole = "buyer";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

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
      return "/";
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

        if (password.length < 6) {
          throw new Error("Please use a password with at least 6 characters.");
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
      <Input type="password" name="password" placeholder="Password" minLength={6} required />
      {mode === "register" ? (
        <div className="rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink/65">
          New public accounts start as standard CarNest users. Any advanced access is managed separately after account setup.
        </div>
      ) : null}
      {mode === "register" && TURNSTILE_ENABLED ? (
        <TurnstileField
          token={turnstileToken}
          onTokenChange={setTurnstileToken}
          helperText="Complete the security check to finish creating your account."
        />
      ) : null}
      <div className="rounded-[24px] bg-shell p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Role model placeholders</p>
        <div className="mt-3 grid gap-3">
          {ROLE_PLACEHOLDERS.map((item) => (
            <div key={item.role} className="rounded-2xl border border-black/5 bg-white px-4 py-3">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-ink/60">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

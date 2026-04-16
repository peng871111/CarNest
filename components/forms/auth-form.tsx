"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { ROLE_PLACEHOLDERS } from "@/lib/roles";
import { UserRole } from "@/types";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const redirect = searchParams.get("redirect");

    function resolveDestination(role: UserRole) {
      if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) return redirect;
      return role === "admin" || role === "super_admin" ? "/admin/vehicles" : role === "seller" ? "/seller/vehicles" : "/dashboard";
    }

    try {
      if (mode === "login") {
        const user = await login(String(form.get("email")), String(form.get("password")));
        router.push(resolveDestination(user.role));
      } else {
        const role = String(form.get("role")) as UserRole;
        const user = await register({
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          role
        });
        router.push(resolveDestination(user.role));
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
      <Input type="password" name="password" placeholder="Password" required />
      {mode === "register" && (
        <select name="role" className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm">
          <option value="buyer">Buyer</option>
          <option value="seller">Seller</option>
        </select>
      )}
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

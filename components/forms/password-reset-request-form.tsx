"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export function PasswordResetRequestForm() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!email.trim()) {
        throw new Error("Please enter your email address.");
      }

      await requestPasswordReset(email.trim().toLowerCase());
      setSuccess("Password reset email sent. Please check your inbox for the reset link.");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
      <Input
        type="email"
        name="email"
        placeholder="Email address"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending..." : "Send reset email"}
      </Button>
    </form>
  );
}

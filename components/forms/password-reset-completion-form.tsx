"use client";

import Link from "next/link";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearResetRequiredStateForEmail, mapAuthError } from "@/lib/auth";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

type PasswordResetCompletionFormProps = {
  mode: string;
  oobCode: string;
  apiKey: string;
  continueUrl: string;
};

export function PasswordResetCompletionForm({
  mode,
  oobCode,
  apiKey,
  continueUrl
}: PasswordResetCompletionFormProps) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  const returnPath = useMemo(() => {
    if (!continueUrl) return "/login";

    try {
      const decodedUrl = decodeURIComponent(continueUrl);
      const url = new URL(decodedUrl);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return continueUrl.startsWith("/") ? continueUrl : "/login";
    }
  }, [continueUrl]);

  useEffect(() => {
    let active = true;

    async function verifyCode() {
      if (!isFirebaseConfigured) {
        if (active) {
          setError("Secure password reset is temporarily unavailable. Please try again later.");
          setVerifying(false);
        }
        return;
      }

      if (mode !== "resetPassword" || !oobCode) {
        if (active) {
          setError("This password reset link is incomplete. Please request a new reset email.");
          setVerifying(false);
        }
        return;
      }

      try {
        const resolvedEmail = await verifyPasswordResetCode(auth, oobCode);
        if (!active) return;
        setEmail(resolvedEmail);
        setError("");
      } catch (verificationError) {
        if (!active) return;
        setError(mapAuthError(verificationError));
      } finally {
        if (active) {
          setVerifying(false);
        }
      }
    }

    void verifyCode();

    return () => {
      active = false;
    };
  }, [mode, oobCode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!oobCode) {
      setError("This password reset link is incomplete. Please request a new reset email.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!newPassword) {
        throw new Error("Please enter a new password.");
      }

      if (newPassword.length < 6) {
        throw new Error("Please use a password with at least 6 characters.");
      }

      if (newPassword !== confirmNewPassword) {
        throw new Error("New password and confirmation do not match.");
      }

      await confirmPasswordReset(auth, oobCode, newPassword);
      if (email) {
        await clearResetRequiredStateForEmail(email, newPassword);
      }
      setSuccess("Your password has been reset successfully. You can now sign in with your new password.");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div className="rounded-[28px] border border-black/5 bg-white p-8 text-sm text-ink/65 shadow-panel">
        Verifying your reset link...
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
      <div className="space-y-2 text-sm text-ink/65">
        <p>
          {email ? (
            <>
              Resetting password for <span className="font-semibold text-ink">{email}</span>
            </>
          ) : (
            "Use this screen to set a new password for your CarNest account."
          )}
        </p>
        {apiKey ? <p className="sr-only">Firebase apiKey present in reset link.</p> : null}
      </div>

      {success ? (
        <div className="space-y-4">
          <p className="text-sm text-emerald-700">{success}</p>
          <Link href={returnPath} className="inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90">
            Return to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">New password</span>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-ink">Confirm new password</span>
            <Input
              type="password"
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <p className="text-sm leading-6 text-ink/60">
            This secure reset page reads the Firebase reset link parameters and applies your new password directly through Firebase Auth.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Set new password"}
            </Button>
            <Link href="/auth/forgot-password" className="text-sm font-medium text-ink/60 transition hover:text-bronze">
              Request a new reset link
            </Link>
          </div>
        </form>
      )}

      {!success && error ? (
        <p className="text-sm leading-6 text-ink/60">
          If this link has expired, request a fresh password reset email and use the most recent message.
        </p>
      ) : null}
    </div>
  );
}

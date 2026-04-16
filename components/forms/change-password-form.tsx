"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

export function ChangePasswordForm() {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!currentPassword) {
        throw new Error("Please enter your current password.");
      }

      if (!newPassword) {
        throw new Error("Please enter a new password.");
      }

      if (newPassword.length < 6) {
        throw new Error("Please use a password with at least 6 characters.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation do not match.");
      }

      if (currentPassword === newPassword) {
        throw new Error("Please choose a new password that is different from your current one.");
      }

      await changePassword({ currentPassword, newPassword });
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-[28px] border border-black/5 bg-white p-8 shadow-panel">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-ink">Current password</span>
        <Input
          type="password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          required
        />
      </label>
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
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={6}
          required
        />
      </label>
      <p className="text-sm leading-6 text-ink/60">
        For security, CarNest will ask Firebase to re-authenticate your current password before applying the update.
      </p>
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
        {loading ? "Updating..." : "Change password"}
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";

export type ProtectedAction = "offer" | "inspection" | "save" | "pricing" | "default";

const ACTION_COPY: Record<
  ProtectedAction,
  {
    title: string;
    body: string;
  }
> = {
  default: {
    title: "Continue with CarNest",
    body: "Sign in or create an account to save vehicles, submit offers, book inspections, and manage your activity."
  },
  offer: {
    title: "Continue to submit your offer",
    body: "Sign in or create an account so the seller can contact you securely."
  },
  inspection: {
    title: "Continue to book an inspection",
    body: "Sign in or create an account so we can coordinate your inspection request."
  },
  save: {
    title: "Save this vehicle",
    body: "Create an account to keep track of vehicles you’re interested in."
  },
  pricing: {
    title: "Continue to request pricing advice",
    body: "Sign in or create an account so our team can respond to your request."
  }
};

export function AuthGateModal({
  open,
  action,
  redirectPath,
  onClose
}: {
  open: boolean;
  action: ProtectedAction;
  redirectPath: string;
  onClose: () => void;
}) {
  if (!open) return null;

  const copy = ACTION_COPY[action] ?? ACTION_COPY.default;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-[28px] bg-white p-7 shadow-panel">
        <p className="text-xs uppercase tracking-[0.25em] text-bronze">Continue with CarNest</p>
        <h3 className="mt-3 text-2xl font-semibold text-ink">{copy.title}</h3>
        <p className="mt-3 text-sm leading-6 text-ink/70">{copy.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90"
          >
            Sign in
          </Link>
          <Link
            href={`/register?redirect=${encodeURIComponent(redirectPath)}`}
            className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
          >
            Create account
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 text-sm font-medium text-ink/60 transition hover:text-ink"
        >
          Continue browsing
        </button>
      </div>
    </div>
  );
}

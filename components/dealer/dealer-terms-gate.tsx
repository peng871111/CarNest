"use client";

import { ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { acceptDealerTerms, getDealerApplicationByUserId } from "@/lib/data";

const DEALER_TERMS = [
  "You hold a valid LMCT licence in your operating state.",
  "All vehicles listed are legally owned by you or listed with lawful authority to sell.",
  "You will not publish false, misleading, or deceptive information.",
  "You will comply with Australian Consumer Law and all applicable state and federal laws.",
  "You will not publish unlawful, stolen, encumbered, fake, or duplicate listings.",
  "You understand CarNest may suspend, restrict, or remove listings or dealer access where compliance concerns arise.",
  "You agree to operate your account and listings in accordance with platform rules and applicable law."
];

export function DealerTermsGate({ children }: { children: ReactNode }) {
  const { appUser, loading } = useAuth();
  const [agreed, setAgreed] = useState(Boolean(appUser?.agreedToDealerTerms || appUser?.agreedToTerms));
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAgreement() {
      if (!appUser?.id) return;
      const application = await getDealerApplicationByUserId(appUser.id).catch(() => null);
      if (!cancelled) {
        setAgreed(Boolean(appUser.agreedToDealerTerms || appUser.agreedToTerms || application?.agreedToDealerTerms || application?.agreedToTerms));
      }
    }

    void loadAgreement();

    return () => {
      cancelled = true;
    };
  }, [appUser?.agreedToDealerTerms, appUser?.agreedToTerms, appUser?.id]);

  async function handleAccept() {
    if (!appUser) {
      setError("Sign in to accept dealer terms.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await acceptDealerTerms(appUser);
      setAgreed(true);
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept dealer terms.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-ink/60">Loading dealer access...</p>;
  }

  if (agreed) {
    return <>{children}</>;
  }

  return (
    <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer compliance</p>
      <h1 className="mt-4 font-display text-4xl text-ink">Accept Dealer Terms</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
        Before dealer tools are activated, please confirm the compliance terms for using CarNest as a dealer.
      </p>

      <div className="mt-6 rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm leading-6 text-ink/70">
        <p className="font-semibold text-ink">By creating and operating a dealer account on CarNest, you confirm that:</p>
        <ol className="mt-3 space-y-2">
          {DEALER_TERMS.map((term, index) => (
            <li key={term}>{index + 1}. {term}</li>
          ))}
        </ol>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm text-ink/70">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-1"
        />
        <span>I agree to CarNest Dealer Terms and Compliance</span>
      </label>

      {error ? <p className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <Button type="button" disabled={!checked || submitting} onClick={() => void handleAccept()} className="mt-6">
        {submitting ? "Saving..." : "Accept and continue"}
      </Button>
    </section>
  );
}

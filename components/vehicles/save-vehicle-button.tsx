"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthGateModal } from "@/components/auth/auth-gate-modal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { getSavedVehicleRecord, saveVehicle } from "@/lib/data";

export function SaveVehicleButton({ vehicleId }: { vehicleId: string }) {
  const { appUser, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const autoSaveTriggered = useRef(false);
  const canUseSavedVehicles = Boolean(appUser && appUser.role !== "admin" && appUser.role !== "super_admin");

  useEffect(() => {
    async function checkSavedState() {
      if (!canUseSavedVehicles || !appUser) {
        setSaved(false);
        return;
      }

      setChecking(true);
      const existing = await getSavedVehicleRecord(appUser.id, vehicleId);
      setSaved(Boolean(existing));
      setChecking(false);
    }

    void checkSavedState();
  }, [appUser, canUseSavedVehicles, vehicleId]);

  useEffect(() => {
    async function resumeSaveIntent() {
      if (autoSaveTriggered.current) return;
      if (searchParams.get("action") !== "save") return;
      if (!appUser || !canUseSavedVehicles || saved || checking || saving) return;

      autoSaveTriggered.current = true;
      try {
        await handleSave(true);
      } finally {
        router.replace(`/inventory/${vehicleId}`);
      }
    }

    void resumeSaveIntent();
  }, [appUser, canUseSavedVehicles, checking, router, saved, saving, searchParams, vehicleId]);

  async function handleSave(fromResume = false) {
    if (!appUser || !canUseSavedVehicles) return;

    setSaving(true);
    if (!fromResume) {
      setMessage("");
    }

    try {
      await saveVehicle({ userId: appUser.id, vehicleId });
      setSaved(true);
      setMessage("Vehicle saved to your dashboard.");
    } catch (saveError) {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
        <p className="text-sm text-ink/60">Loading saved vehicle options...</p>
      </div>
    );
  }

  if (!appUser) {
    return (
      <>
        <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
          <p className="text-xs uppercase tracking-[0.22em] text-bronze">Save vehicle</p>
          <p className="mt-3 text-sm leading-6 text-ink/70">Keep this listing in your shortlist so it is easy to revisit later.</p>
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="mt-4 inline-flex items-center justify-center rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink transition hover:border-bronze hover:text-bronze"
          >
            Save Vehicle
          </button>
        </div>
        <AuthGateModal
          open={showAuthModal}
          action="save"
          redirectPath={`/inventory/${vehicleId}?action=save`}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  if (!canUseSavedVehicles) {
    return (
      <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
        <p className="text-xs uppercase tracking-[0.22em] text-bronze">Save vehicle</p>
        <p className="mt-3 text-sm leading-6 text-ink/70">Saved vehicles are available from standard CarNest accounts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white p-5 shadow-panel">
      <p className="text-xs uppercase tracking-[0.22em] text-bronze">Save vehicle</p>
      <p className="mt-3 text-sm leading-6 text-ink/70">Keep this listing in your account so it is easy to revisit later.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" disabled={checking || saving || saved} onClick={() => void handleSave()}>
          {checking ? "Checking..." : saving ? "Saving..." : saved ? "Saved" : "Save Vehicle"}
        </Button>
        {saved ? (
          <Link href="/dashboard/saved" className="text-sm font-medium text-ink/65 transition hover:text-bronze">
            View saved vehicles
          </Link>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-sm text-ink/65">{message}</p> : null}
    </div>
  );
}

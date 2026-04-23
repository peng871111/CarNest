"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DealerApplicationStatusBadge } from "@/components/admin/dealer-application-status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { reviewDealerApplication } from "@/lib/data";
import { DealerApplication } from "@/types";

type ReviewAction = "approve" | "reject" | "request_info";

type PendingReviewAction = {
  applicationId: string;
  action: ReviewAction;
} | null;

function formatDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getRiskTone(riskLevel: DealerApplication["riskLevel"]) {
  if (riskLevel === "high") return "border-red-200 bg-red-50 text-red-700";
  if (riskLevel === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getVerificationTone(status: DealerApplication["licenceVerificationStatus"]) {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "auto_failed") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function DealerApplicationReviewBoard({ initialApplications }: { initialApplications: DealerApplication[] }) {
  const { appUser } = useAuth();
  const [applications, setApplications] = useState(initialApplications);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<PendingReviewAction>(null);
  const [searchText, setSearchText] = useState("");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const summary = useMemo(() => ({
    pending: applications.filter((item) => item.status === "pending" || item.status === "pending_review").length,
    infoRequested: applications.filter((item) => item.status === "info_requested").length,
    approved: applications.filter((item) => item.status === "approved").length
  }), [applications]);

  const filteredApplications = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return applications;

    return applications.filter((application) => [
      application.contactEmail,
      application.contactPhone,
      application.abn,
      application.lmctNumber
    ].some((value) => value.toLowerCase().includes(query)));
  }, [applications, searchText]);

  function getActionLabel(action: ReviewAction) {
    if (action === "request_info") return "Request more info";
    return action === "approve" ? "Approve" : "Reject";
  }

  function getConfirmMessage(action: ReviewAction) {
    if (action === "approve") return "Approve this dealer application and unlock dealer access immediately?";
    if (action === "reject") return "Reject this dealer application and keep dealer access disabled?";
    return "Mark this application as info requested and keep dealer access disabled until the applicant responds?";
  }

  function canConfirmAction(application: DealerApplication, action: ReviewAction) {
    const note = (notes[application.id] ?? "").trim();
    if (action === "reject" || action === "request_info") {
      return Boolean(note);
    }
    return true;
  }

  async function handleReview(application: DealerApplication, action: ReviewAction) {
    if (!appUser) {
      setError("Admin session not available.");
      return;
    }

    setBusyId(application.id);
    setError("");
    setNotice("");

    try {
      const result = await reviewDealerApplication(
        application.id,
        action,
        appUser,
        application,
        {
          reviewedBy: appUser.displayName || appUser.name || appUser.email,
          rejectReason: action === "reject" ? notes[application.id] ?? "" : undefined,
          infoRequestNote: action === "request_info" ? notes[application.id] ?? "" : undefined
        }
      );

      setApplications((current) => current.map((item) => (item.id === application.id ? result.application : item)));
      setNotice(
        action === "approve"
          ? "Dealer application approved and dealer access unlocked."
          : action === "reject"
            ? "Dealer application rejected."
            : "Dealer application marked as info requested."
      );
      setNotes((current) => ({ ...current, [application.id]: "" }));
      setPendingAction(null);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to update the dealer application.");
    } finally {
      setBusyId("");
    }
  }

  function openConfirm(applicationId: string, action: ReviewAction) {
    setPendingAction({ applicationId, action });
    setError("");
    setNotice("");
  }

  function cancelConfirm() {
    setPendingAction(null);
  }

  function toggleExpanded(applicationId: string) {
    setExpandedIds((current) => ({
      ...current,
      [applicationId]: !current[applicationId]
    }));
  }

  if (!applications.length) {
    return (
      <section className="rounded-[32px] border border-black/5 bg-white p-10 shadow-panel">
        <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer applications</p>
        <h2 className="mt-3 font-display text-3xl text-ink">No dealer applications yet</h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
          New dealer submissions will appear here once applicants complete the verification form.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Pending applications: {summary.pending}</div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Info requested: {summary.infoRequested}</div>
        <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">Approved dealers: {summary.approved}</div>
      </div>

      {notice ? <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
      {error ? <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}

      <label className="block rounded-[28px] border border-black/5 bg-white p-4 shadow-panel">
        <span className="text-xs uppercase tracking-[0.22em] text-ink/45">Search applications</span>
        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search by email, phone, ABN, or LMCT"
          className="mt-3 w-full rounded-2xl border border-black/10 bg-shell px-4 py-3 text-sm text-ink outline-none transition focus:border-bronze"
        />
      </label>

      <section className="space-y-4">
        {filteredApplications.length ? filteredApplications.map((application) => {
          const expanded = Boolean(expandedIds[application.id]);

          return (
          <article key={application.id} className="rounded-[32px] border border-black/5 bg-white p-6 shadow-panel">
            <button
              type="button"
              onClick={() => toggleExpanded(application.id)}
              className="flex w-full flex-wrap items-start justify-between gap-4 text-left"
            >
              <div>
                <p className="font-semibold text-ink">{application.contactPersonName || "Unnamed applicant"}</p>
                <p className="mt-1 text-sm text-ink/60">{application.contactEmail || "No email"}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/40">
                  Ref {application.referenceId} · Submitted {formatDateTime(application.requestedAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DealerApplicationStatusBadge status={application.status} />
                <span className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-ink/60">
                  {expanded ? "Collapse" : "Expand"}
                </span>
              </div>
            </button>

            {expanded ? (
              <>
            <div className="mt-6 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getVerificationTone(application.licenceVerificationStatus)}`}>
                  {application.licenceVerificationStatus.replaceAll("_", " ")}
                </span>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getRiskTone(application.riskLevel)}`}>
                  {application.riskLevel} risk
                </span>
              </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1 text-sm text-ink/70">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Business</p>
                <p>{application.legalBusinessName || "Not provided"}</p>
                <p>{application.tradingName || "No trading name provided"}</p>
              </div>
              <div className="space-y-1 text-sm text-ink/70">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Identifiers</p>
                <p>ABN: {application.abn || "Not provided"}</p>
                <p>ACN: {application.acn || "Not provided"}</p>
                <p>LMCT: {application.lmctNumber || "Not provided"}</p>
              </div>
              <div className="space-y-1 text-sm text-ink/70">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Licence</p>
                <p>{application.licenceState || "Not provided"}</p>
                <p>Expires {formatDate(application.licenceExpiry)}</p>
                <p>Dealer status: {application.dealerStatus.replaceAll("_", " ")}</p>
              </div>
              <div className="space-y-1 text-sm text-ink/70">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Submitted</p>
                <p>Reference: {application.referenceId}</p>
                <p>{formatDateTime(application.requestedAt)}</p>
                <p>Reviewed {formatDateTime(application.reviewedAt)}</p>
                <p>{application.reviewedBy ? `By ${application.reviewedBy}` : "Not reviewed yet"}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1 text-sm text-ink/70 xl:col-span-2">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Business address</p>
                <p>{application.businessAddressLine1 || "Not provided"}</p>
                <p>{[application.businessSuburb, application.businessPostcode, application.businessState].filter(Boolean).join(", ") || "Not provided"}</p>
              </div>
              <div className="space-y-1 text-sm text-ink/70">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Proof</p>
                {application.proofFiles.length ? (
                  <div className="space-y-2">
                    {application.proofFiles.map((file, index) => (
                      <Link
                        key={`${application.id}-proof-${file.url}-${index}`}
                        href={file.url}
                        target="_blank"
                        className="block font-medium text-ink underline"
                      >
                        {file.name || `Open uploaded proof ${application.proofFiles.length > 1 ? index + 1 : ""}`.trim()}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p>No proof uploaded</p>
                )}
              </div>
              <div className="space-y-1 text-sm text-ink/70">
                <p className="text-xs uppercase tracking-[0.18em] text-ink/45">Duplicate flags</p>
                <p>{application.duplicateMatchFlags.hasAny ? "Potential duplicate matches found" : "No duplicate matches detected"}</p>
                {application.duplicateMatchedApplicationIds.length ? (
                  <p className="text-xs text-ink/50">Related application matches: {application.duplicateMatchedApplicationIds.length}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
                Free email domain: {application.trustIndicators.freeEmailDomain ? "Flagged" : "No"}
              </div>
              <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
                Rejection history: {application.rejectionHistoryCount}
              </div>
              <div className="rounded-[24px] bg-shell px-4 py-3 text-sm text-ink/70">
                Location consistency: {application.trustIndicators.businessLocationConsistent ? "Matched" : "Needs review"}
              </div>
            </div>

            {application.rejectReason ? (
              <p className="mt-4 text-sm text-red-700">Reject reason: {application.rejectReason}</p>
            ) : null}
            {application.adminNote || application.infoRequestNote ? (
              <p className="mt-2 text-sm text-amber-700">Info requested: {application.adminNote || application.infoRequestNote}</p>
            ) : null}
            {application.dealerResponseNote ? (
              <p className="mt-2 text-sm text-ink/70">Dealer response: {application.dealerResponseNote}</p>
            ) : null}
            {application.additionalUploads.length ? (
              <div className="mt-3 space-y-2 text-sm text-ink/70">
                <p className="font-medium text-ink">Additional documents</p>
                {application.additionalUploads.map((file, index) => (
                  <Link key={`${application.id}-additional-${file.url}-${index}`} href={file.url} target="_blank" className="block font-medium text-ink underline">
                    {file.name || `Open additional document ${index + 1}`}
                  </Link>
                ))}
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-ink">
                Admin note
                <Textarea
                  value={notes[application.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [application.id]: event.target.value }))}
                  placeholder="Add a rejection reason or request-for-info note when needed."
                  className="mt-2 min-h-24"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="button" disabled={busyId === application.id} onClick={() => openConfirm(application.id, "approve")}>
                  {busyId === application.id && pendingAction?.action === "approve" ? "Saving..." : "Approve"}
                </Button>
                <Button
                  type="button"
                  disabled={busyId === application.id}
                  className="bg-white text-ink border border-black/10 hover:bg-shell"
                  onClick={() => openConfirm(application.id, "request_info")}
                >
                  {busyId === application.id && pendingAction?.action === "request_info" ? "Saving..." : "Request more info"}
                </Button>
                <Button
                  type="button"
                  disabled={busyId === application.id}
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => openConfirm(application.id, "reject")}
                >
                  {busyId === application.id && pendingAction?.action === "reject" ? "Saving..." : "Reject"}
                </Button>
              </div>
              {pendingAction?.applicationId === application.id ? (
                <div className="rounded-[24px] border border-black/10 bg-shell px-4 py-4">
                  <p className="text-sm font-medium text-ink">{getConfirmMessage(pendingAction.action)}</p>
                  {(pendingAction.action === "reject" || pendingAction.action === "request_info") && !canConfirmAction(application, pendingAction.action) ? (
                    <p className="mt-2 text-sm text-red-600">
                      {pendingAction.action === "reject" ? "Add a reject reason before confirming." : "Add an info request note before confirming."}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      disabled={busyId === application.id || !canConfirmAction(application, pendingAction.action)}
                      onClick={() => void handleReview(application, pendingAction.action)}
                    >
                      {busyId === application.id ? `${getActionLabel(pendingAction.action)}...` : `Confirm ${getActionLabel(pendingAction.action)}`}
                    </Button>
                    <Button
                      type="button"
                      className="border border-black/10 bg-white text-ink hover:bg-white"
                      disabled={busyId === application.id}
                      onClick={cancelConfirm}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            </>
            ) : null}
          </article>
        )}) : (
          <div className="rounded-[32px] border border-black/5 bg-white p-8 text-sm text-ink/60 shadow-panel">
            No dealer applications match that search.
          </div>
        )}
      </section>
    </div>
  );
}

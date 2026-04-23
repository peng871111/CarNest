"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { submitDealerAdditionalInformation } from "@/lib/data";
import { uploadDealerAdditionalDocuments } from "@/lib/storage";
import { DealerApplication } from "@/types";

const ADDITIONAL_DOCUMENT_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function DealerAdditionalInfoPanel({
  application,
  onUpdated
}: {
  application: DealerApplication;
  onUpdated: (application: DealerApplication) => void;
}) {
  const { appUser } = useAuth();
  const [dealerResponseNote, setDealerResponseNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []));
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!appUser) {
      setError("Sign in to update your dealer application.");
      return;
    }

    if (!dealerResponseNote.trim() && !files.length) {
      setError("Add a response note or upload at least one additional document.");
      return;
    }

    setSubmitting(true);

    try {
      const additionalUploads = files.length ? await uploadDealerAdditionalDocuments(files, appUser.id) : [];
      const result = await submitDealerAdditionalInformation(
        application.id,
        {
          dealerResponseNote,
          additionalUploads
        },
        appUser
      );

      onUpdated(result.application);
      setDealerResponseNote("");
      setFiles([]);
      setNotice("Additional information submitted. Your application is back under review.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit additional information.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[32px] border border-black/5 bg-white p-8 shadow-panel">
      <p className="text-xs uppercase tracking-[0.28em] text-bronze">Dealer application</p>
      <h1 className="mt-4 font-display text-4xl text-ink">Provide additional information</h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
        We need a few more details before we can continue reviewing your application.
      </p>

      <div className="mt-6 rounded-[24px] border border-black/5 bg-shell px-5 py-4">
        <p className="text-xs uppercase tracking-[0.22em] text-bronze">Admin note</p>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          {application.adminNote || application.infoRequestNote || "CarNest has requested additional information for this application."}
        </p>
      </div>

      <div className="mt-6 grid gap-3 rounded-[24px] border border-black/5 bg-shell px-5 py-4 text-sm text-ink/65 md:grid-cols-2">
        <p>Reference: {application.referenceId}</p>
        <p>Business: {application.legalBusinessName || application.tradingName || "Not provided"}</p>
        <p>ABN: {application.abn || "Not provided"}</p>
        <p>ACN: {application.acn || "Not provided"}</p>
        <p>LMCT: {application.lmctNumber || "Not provided"}</p>
        <p>Licence state: {application.licenceState || "Not provided"}</p>
        <p>Contact: {application.contactPersonName || "Not provided"}</p>
        <p>Email: {application.contactEmail || "Not provided"}</p>
      </div>

      {application.additionalUploads.length ? (
        <div className="mt-6 rounded-[24px] border border-black/5 bg-shell px-5 py-4">
          <p className="text-xs uppercase tracking-[0.22em] text-bronze">Previously supplied additional documents</p>
          <div className="mt-3 space-y-2">
            {application.additionalUploads.map((file, index) => (
              <Link key={`${file.url}-${index}`} href={file.url} target="_blank" className="block text-sm font-medium text-ink underline">
                {file.name || `Additional document ${index + 1}`}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <label className="block text-sm font-medium text-ink">
          Dealer explanation
          <Textarea
            value={dealerResponseNote}
            onChange={(event) => {
              setDealerResponseNote(event.target.value);
              setError("");
              setNotice("");
            }}
            placeholder="Add a short explanation or response for the CarNest review team."
            className="mt-2"
          />
        </label>

        <label className="block text-sm font-medium text-ink">
          Additional documents
          <input
            type="file"
            accept={ADDITIONAL_DOCUMENT_ACCEPT}
            multiple
            onChange={handleFileChange}
            className="mt-2 block w-full text-sm text-ink/65"
          />
        </label>

        {files.length ? (
          <p className="text-sm text-ink/55">
            {files.length} additional file{files.length === 1 ? "" : "s"} selected.
          </p>
        ) : null}

        {error ? <p className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p> : null}

        <div className="flex flex-wrap gap-4">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit additional information"}
          </Button>
          <Link href="/" className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink">
            Back to site
          </Link>
        </div>
      </form>
    </section>
  );
}

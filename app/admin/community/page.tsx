"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_LABELS,
  createCommunityMoment,
  createCommunityMomentId,
  listCommunityMomentsForAdmin,
  updateCommunityMoment,
} from "@/lib/community";
import { uploadCommunityMomentImage } from "@/lib/community-storage";
import type { CommunityMoment, CommunityMomentCategoryId, CommunityMomentStatus } from "@/types";

type StatusFilter = "all" | "draft" | "published" | "featured";

interface CommunityMomentFormState {
  category: CommunityMomentCategoryId;
  status: CommunityMomentStatus;
  featured: boolean;
  title: string;
  caption: string;
  momentDate: string;
  location: string;
  linkedListingId: string;
}

const EMPTY_FORM: CommunityMomentFormState = {
  category: "on-the-road",
  status: "draft",
  featured: false,
  title: "",
  caption: "",
  momentDate: "",
  location: "",
  linkedListingId: "",
};

function formatMomentDate(value?: string) {
  if (!value) return "Not dated";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getFormStateFromMoment(moment: CommunityMoment): CommunityMomentFormState {
  return {
    category: moment.category,
    status: moment.status,
    featured: moment.featured,
    title: moment.title ?? "",
    caption: moment.caption ?? "",
    momentDate: moment.momentDate ? moment.momentDate.slice(0, 10) : "",
    location: moment.location ?? "",
    linkedListingId: moment.linkedListingId ?? "",
  };
}

export default function AdminCommunityPage() {
  const { appUser, firebaseUser, loading: authLoading } = useAuth();
  const [moments, setMoments] = useState<CommunityMoment[]>([]);
  const [loadingMoments, setLoadingMoments] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | CommunityMomentCategoryId>("all");
  const [editingMoment, setEditingMoment] = useState<CommunityMoment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CommunityMomentFormState>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingMomentId, setDeletingMomentId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadMoments() {
    if (authLoading || !appUser) return;
    setLoadingMoments(true);
    setError("");

    try {
      const items = await listCommunityMomentsForAdmin(appUser);
      setMoments(items);
    } catch (loadError) {
      console.error("[community-admin] Failed to load Community moments.", {
        error: loadError instanceof Error ? loadError.message : String(loadError),
      });
      setMoments([]);
      setError("Community moments could not be loaded right now. Please try again.");
    } finally {
      setLoadingMoments(false);
    }
  }

  useEffect(() => {
    void loadMoments();
  }, [appUser?.id, authLoading]);

  const filteredMoments = useMemo(
    () =>
      moments.filter((moment) => {
        const matchesStatus =
          statusFilter === "all"
          || moment.status === statusFilter
          || (statusFilter === "featured" && moment.featured);
        const matchesCategory = categoryFilter === "all" || moment.category === categoryFilter;
        return matchesStatus && matchesCategory;
      }),
    [categoryFilter, moments, statusFilter]
  );

  function openCreateForm() {
    setEditingMoment(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
    setNotice("");
    setError("");
    setFormOpen(true);
  }

  function openEditForm(moment: CommunityMoment) {
    setEditingMoment(moment);
    setForm(getFormStateFromMoment(moment));
    setImageFile(null);
    setNotice("");
    setError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingMoment(null);
    setForm(EMPTY_FORM);
    setImageFile(null);
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImageFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appUser) return;

    setSaving(true);
    setNotice("");
    setError("");

    try {
      const momentId = editingMoment?.id ?? createCommunityMomentId();
      const image = imageFile ? await uploadCommunityMomentImage(imageFile, momentId) : undefined;

      if (editingMoment) {
        await updateCommunityMoment(
          editingMoment,
          {
            ...form,
            image,
          },
          appUser
        );
        setNotice("Community moment updated.");
      } else {
        if (!image) {
          throw new Error("Upload a primary image before saving this Community moment.");
        }
        await createCommunityMoment(
          momentId,
          {
            ...form,
            image,
          },
          appUser
        );
        setNotice("Community moment created.");
      }

      closeForm();
      await loadMoments();
    } catch (saveError) {
      console.error("[community-admin] Failed to save Community moment.", {
        error: saveError instanceof Error ? saveError.message : String(saveError),
      });
      setError(saveError instanceof Error ? saveError.message : "Community moment could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMoment(moment: CommunityMoment) {
    const confirmed = window.confirm(
      "Delete this Community moment?\n\nThis will remove the photo from the public Community page."
    );
    if (!confirmed) return;

    setDeletingMomentId(moment.id);
    setNotice("");
    setError("");

    try {
      const idToken = await firebaseUser?.getIdToken(true);
      if (!idToken) {
        throw new Error("Admin authentication has expired. Please sign in again.");
      }

      const response = await fetch(`/api/admin/community/moments/${encodeURIComponent(moment.id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const result = await response.json().catch(() => null) as { success?: boolean; error?: string; message?: string } | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to delete this Community moment right now.");
      }

      setNotice(result.message || "Community moment deleted.");
      setMoments((current) => current.filter((item) => item.id !== moment.id));
    } catch (deleteError) {
      console.error("[community-admin] Failed to delete Community moment.", {
        momentId: moment.id,
        error: deleteError instanceof Error ? deleteError.message : String(deleteError),
      });
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete this Community moment right now.");
    } finally {
      setDeletingMomentId("");
    }
  }

  return (
    <AdminShell
      title="Community"
      description="Manage CarNest moments, community photos and featured stories."
      requiredPermission="manageVehicles"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink/60">
            Add editorial one-photo moments without changing listing, storage contract, or customer workflows.
          </p>
        </div>
        <Button type="button" onClick={openCreateForm}>
          + Add Moment
        </Button>
      </div>

      {notice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

      {formOpen ? (
        <section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-bronze">
                {editingMoment ? "Edit Moment" : "New Moment"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {editingMoment ? editingMoment.title || "Untitled moment" : "Create Community moment"}
              </h2>
            </div>
            <button type="button" onClick={closeForm} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-ink">
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Primary image {editingMoment ? "(optional replacement)" : "*"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  onChange={handleImageChange}
                  required={!editingMoment}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Category *</span>
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as CommunityMomentCategoryId }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                >
                  {COMMUNITY_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Title</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  maxLength={120}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  placeholder="On the road with CarNest"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Location</span>
                <input
                  value={form.location}
                  onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                  maxLength={120}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  placeholder="Melbourne, VIC"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Short caption</span>
              <textarea
                value={form.caption}
                onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
                maxLength={360}
                rows={3}
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                placeholder="A quiet stretch of road, a good car, and nowhere to rush."
              />
            </label>

            <div className="grid gap-5 md:grid-cols-4">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Date</span>
                <input
                  type="date"
                  value={form.momentDate}
                  onChange={(event) => setForm((current) => ({ ...current, momentDate: event.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CommunityMomentStatus }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.18em] text-ink/50">Linked listing ID</span>
                <input
                  value={form.linkedListingId}
                  onChange={(event) => setForm((current) => ({ ...current, linkedListingId: event.target.value }))}
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink"
                  placeholder="Optional CarNest listing ID"
                />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-[20px] border border-black/5 bg-shell px-4 py-3">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) => setForm((current) => ({ ...current, featured: event.target.checked }))}
                className="h-4 w-4 rounded border-black/20 text-ink"
              />
              <span className="text-sm font-medium text-ink">Feature this moment on the homepage when published</span>
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeForm} className="rounded-full border border-black/10 px-5 py-3 text-sm font-semibold text-ink">
                Cancel
              </button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingMoment ? "Save changes" : "Create moment"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-[32px] border border-black/5 bg-white shadow-panel">
        <div className="border-b border-black/5 px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-bronze">Community library</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Moments</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "draft", "published", "featured"] as StatusFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setStatusFilter(filter)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold capitalize transition ${
                    statusFilter === filter
                      ? "border-ink bg-ink text-white"
                      : "border-black/10 bg-white text-ink hover:bg-shell"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as "all" | CommunityMomentCategoryId)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink md:max-w-xs"
            >
              <option value="all">All categories</option>
              {COMMUNITY_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
          {loadingMoments ? (
            <div className="col-span-full py-12 text-sm text-ink/60">Loading Community moments...</div>
          ) : filteredMoments.length ? (
            filteredMoments.map((moment) => (
              <article key={moment.id} className="overflow-hidden rounded-[28px] border border-black/5 bg-shell">
                <div className="relative aspect-[4/3] overflow-hidden bg-black/10">
                  <img
                    src={moment.image.thumbnailUrl}
                    alt={moment.title || `CarNest ${COMMUNITY_CATEGORY_LABELS[moment.category]} moment`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/60">
                        {COMMUNITY_CATEGORY_LABELS[moment.category]}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        moment.published ? "bg-emerald-100 text-emerald-800" : "bg-white text-ink/60"
                      }`}>
                        {moment.published ? "Published" : "Draft"}
                      </span>
                      {moment.featured ? (
                        <span className="rounded-full bg-bronze/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-bronze">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">{moment.title || "Untitled moment"}</h3>
                    <p className="mt-2 text-sm text-ink/60">{formatMomentDate(moment.momentDate || moment.createdAt)}</p>
                    {moment.location ? <p className="mt-1 text-sm text-ink/60">{moment.location}</p> : null}
                    {moment.linkedListingId ? (
                      <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-ink/45">
                        Linked listing: {moment.linkedListingId}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(moment)}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white/70"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteMoment(moment)}
                      disabled={deletingMomentId === moment.id}
                      className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingMomentId === moment.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="col-span-full py-12 text-sm text-ink/60">
              No Community moments match the current filters.
            </div>
          )}
        </div>
      </section>
    </AdminShell>
  );
}

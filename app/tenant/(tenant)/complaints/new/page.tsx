// app/(tenant)/complaints/new/page.tsx
// File a new complaint — PHASE 7: accessible labels, aria-live, inline errors

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitComplaint } from "./actions";

export default function NewComplaintPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [photoCount, setPhotoCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitComplaint(formData);
      if (result.success) {
        router.push("/tenant/complaints");
        router.refresh();
      } else {
        setError(result.error ?? "Failed to submit complaint. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <p className="text-xs tracking-widest text-white/55 uppercase mb-2">Tenant Portal</p>
      <h1 className="text-3xl font-light tracking-tight text-white mb-8">File a Complaint</h1>

      {/* Inline error with aria-live */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-500/10 border border-red-500/30 p-4 mb-6"
        >
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <form action={handleSubmit} className="space-y-6">
        <div>
          <label
            htmlFor="title"
            className="block text-xs tracking-widest text-white/55 uppercase mb-2"
          >
            Title *
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={200}
            placeholder="e.g. Leaking kitchen tap"
            className="w-full px-4 py-3 bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40"
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-xs tracking-widest text-white/55 uppercase mb-2"
          >
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={5}
            maxLength={2000}
            placeholder="Describe the issue in detail..."
            className="w-full px-4 py-3 bg-white/5 border border-white/15 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/40 resize-none"
          />
          <p className="text-xs text-white/55 mt-1">Max 2000 characters</p>
        </div>

        <div>
          <label
            htmlFor="priority"
            className="block text-xs tracking-widest text-white/55 uppercase mb-2"
          >
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue="MEDIUM"
            className="w-full px-4 py-3 bg-white/5 border border-white/15 text-white text-sm focus:outline-none focus:border-white/40"
          >
            <option value="LOW">Low — Non-urgent</option>
            <option value="MEDIUM">Medium — Affects daily living</option>
            <option value="HIGH">High — Safety or security concern</option>
            <option value="URGENT">Urgent — Immediate attention needed</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="photos"
            className="block text-xs tracking-widest text-white/55 uppercase mb-2"
          >
            Photos (Optional)
          </label>
          <input
            id="photos"
            name="photos"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            max={3}
            onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
            className="w-full px-4 py-3 bg-white/5 border border-white/15 text-white text-sm file:text-white/55 file:bg-transparent file:border-0 cursor-pointer"
          />
          <p className="text-xs text-white/55 mt-1">Up to 3 photos. Tap to open camera.</p>
          {/* aria-live photo count */}
          {photoCount > 0 && (
            <p aria-live="polite" className="text-xs text-white/55 mt-2">
              {photoCount} photo{photoCount > 1 ? "s" : ""} selected
            </p>
          )}
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 text-xs tracking-widest uppercase text-white/55 hover:text-white border border-white/25 hover:border-white/50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-3 text-xs tracking-widest uppercase bg-white text-black hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Complaint"}
          </button>
        </div>
      </form>
    </div>
  );
}
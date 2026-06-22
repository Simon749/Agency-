"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-3xl font-semibold mb-4">Something went wrong</h1>
        <p className="text-sm text-slate-400 mb-6">
          We hit an unexpected error. Refresh the page or go back to the dashboard.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            Try again
          </button>
          <a href="/" className="text-sm text-white/70 hover:text-white">
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}

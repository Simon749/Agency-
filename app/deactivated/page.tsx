import Link from "next/link";

export default function DeactivatedPage() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/95 p-8 text-center shadow-2xl shadow-black/40">
        <h1 className="text-3xl font-semibold mb-4">Account Deactivated</h1>
        <p className="text-sm text-slate-400 mb-6">
          Your tenant account is no longer active. Please contact your property manager for next steps.
        </p>
        <Link href="/" className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200">
          Return to home
        </Link>
      </div>
    </div>
  );
}

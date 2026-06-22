export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-white" />
        <p className="text-sm text-white/70">Loading, please wait...</p>
      </div>
    </div>
  );
}

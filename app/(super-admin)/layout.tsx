import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/getRole";
import SignOutButton from "@/components/auth/SignOutCTA";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireRole(["SUPER_ADMIN"]);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/sign-in");
  }

  const navItems = [
    { href: "/super-admin/dashboard", label: "Dashboard" },
    { href: "/super-admin/agencies", label: "Agencies" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold tracking-[0.35em] uppercase">PROPFLOW</span>
            <span className="text-xs uppercase tracking-[0.18em] text-white/60">Super Admin</span>
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="pt-16">
        <div className="md:flex">
          <aside className="hidden w-56 flex-shrink-0 border-r border-white/10 bg-slate-950/95 px-4 py-6 md:block">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          </aside>

          <div className="md:hidden border-b border-white/10 bg-slate-950/95 px-4 py-3">
            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
          </div>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="block rounded-lg px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white">
      {label}
    </a>
  );
}

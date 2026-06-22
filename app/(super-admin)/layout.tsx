import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/getRole";
import { ResponsiveNavbar } from "@/components/ResponsiveNavbar";
import Link from "next/link";

const navItems = [
  { href: "/super-admin/dashboard", label: "Dashboard" },
  { href: "/super-admin/agencies", label: "Agencies" },
];

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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ResponsiveNavbar role="SUPER_ADMIN" navItems={navItems} />

      <div className="pt-16">
        <div className="md:flex">
          {/* ── Desktop Sidebar ── */}
          <aside className="hidden w-56 flex-shrink-0 border-r border-white/10 bg-slate-950/95 px-4 py-6 md:block">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <SidebarLink key={item.href} href={item.href} label={item.label} />
              ))}
            </div>
          </aside>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-sm px-4 py-3 text-sm font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
    >
      {label}
    </Link>
  );
}
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/getRole";
import { ResponsiveNavbar } from "@/components/ResponsiveNavbar";
import Link from "next/link";

const allNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/buildings", label: "Buildings", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/tenants", label: "Tenants", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/leases", label: "Leases", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/complaints", label: "Complaints", roles: ["AGENCY_OWNER", "MANAGER"] },
  { href: "/admin/arrears", label: "Arrears", roles: ["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"] },
  { href: "/admin/agent/meter-readings", label: "Meter Readings", roles: ["FIELD_AGENT", "MANAGER", "AGENCY_OWNER"] },
  { href: "/admin/agent/receipts", label: "Receipts", roles: ["FIELD_AGENT", "MANAGER", "AGENCY_OWNER"] },
  { href: "/admin/settings", label: "Settings", roles: ["AGENCY_OWNER"] },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requireRole(["AGENCY_OWNER", "MANAGER", "FIELD_AGENT"]);
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
    redirect("/sign-in");
  }

  const { role } = session;
  const navItems = allNavItems
    .filter((item) => item.roles.includes(role!))
    .map(({ href, label }) => ({ href, label }));

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <ResponsiveNavbar role={role!} navItems={navItems} />

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
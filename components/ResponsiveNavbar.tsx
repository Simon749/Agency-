"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, ChevronRight } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";

export interface NavItem {
  href: string;
  label: string;
}

interface ResponsiveNavbarProps {
  brand?: string;
  role: string;
  navItems: NavItem[];
  userName?: string;
}

export function ResponsiveNavbar({
  brand = "PROPFLOW",
  role,
  navItems,
  userName,
}: ResponsiveNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const roleLabel = role.replace(/_/g, " ");

  return (
    <>
      {/* ── Fixed Header ── */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Left: Brand + Role Badge */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm font-semibold tracking-[0.35em] uppercase text-white hover:text-white/90 transition"
            >
              {brand}
            </Link>
            <span className="hidden rounded-sm border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/50 md:inline-block">
              {roleLabel}
            </span>
          </div>

          {/* Right: Desktop Sign Out only (nav is in sidebar) */}
          <div className="hidden md:flex items-center gap-3">
            <SignOutButton>
              <button className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white">
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>
            </SignOutButton>
          </div>

          {/* Mobile: Hamburger + Role badge */}
          <div className="flex items-center gap-3 md:hidden">
            <span className="rounded-sm border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/50">
              {roleLabel}
            </span>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-sm text-white/70 transition hover:bg-white/5 hover:text-white"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Slide-down Menu (replaces the broken inline nav) ── */}
      {mobileOpen && (
        <>
          <div className="fixed inset-x-0 top-16 z-30 border-b border-white/10 bg-slate-950/98 backdrop-blur-xl md:hidden">
            <nav className="mx-auto max-w-7xl px-4 py-4">
              {userName && (
                <p className="mb-3 truncate text-xs text-white/40">{userName}</p>
              )}

              <ul className="space-y-px">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center justify-between rounded-sm px-4 py-3.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span>{item.label}</span>
                        {isActive && <ChevronRight className="h-4 w-4 text-white/30" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              {/* Mobile Sign Out */}
              <div className="mt-3 border-t border-white/10 pt-3">
                <SignOutButton>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center gap-2 rounded-sm px-4 py-3.5 text-sm font-medium text-white/50 transition hover:bg-white/5 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </SignOutButton>
              </div>
            </nav>
          </div>

          {/* Overlay */}
          <div
            className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        </>
      )}
    </>
  );
}
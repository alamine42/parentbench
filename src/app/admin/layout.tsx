import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { navItems } from "./nav-items";
import { validateSession } from "@/app/api/admin/auth/route";

export const metadata: Metadata = {
  title: "Admin | ParentBench",
  description: "ParentBench Administration Dashboard",
};

// ============================================================================
// ADMIN AUTH CHECK
// ============================================================================

async function checkAdminAuth() {
  const adminBypass = process.env.ADMIN_BYPASS === "true";
  if (adminBypass) {
    return true;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return process.env.NODE_ENV === "development";
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("admin_session");

  if (!sessionCookie?.value) {
    return false;
  }

  return validateSession(sessionCookie.value, adminPassword);
}

// ============================================================================
// LAYOUT COMPONENT
// ============================================================================

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAuthed = await checkAdminAuth();

  if (!isAuthed) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar - Desktop */}
      <header className="hidden lg:block bg-card-bg border-b border-card-border h-16 fixed top-0 left-0 right-0 z-30">
        <div className="h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <Link href="/admin" className="text-lg font-semibold text-foreground tracking-tight">
              ParentBench
              <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                Admin
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground rounded-lg hover:bg-muted-bg transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              <span>View site</span>
            </Link>
            <div className="w-px h-5 bg-card-border" />
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Top bar - Mobile */}
      <header className="lg:hidden bg-card-bg border-b border-card-border h-14 fixed top-0 left-0 right-0 z-30">
        <div className="h-full px-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">Admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <LogoutButton />
            <MobileNav />
          </div>
        </div>
      </header>

      <div className="flex pt-14 lg:pt-16">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex lg:flex-col w-64 bg-card-bg border-r border-card-border fixed left-0 top-16 bottom-0">
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted hover:text-foreground hover:bg-muted-bg transition-all duration-200 group"
              >
                <span className="text-muted group-hover:text-accent transition-colors">
                  {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex-shrink-0 p-4 border-t border-card-border bg-card-bg">
            <p className="text-xs text-muted text-center">
              ParentBench v1.0
            </p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:ml-64 p-4 lg:p-6 min-h-[calc(100vh-3.5rem)] lg:min-h-[calc(100vh-4rem)]">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  <p className="text-sm text-muted">Loading...</p>
                </div>
              </div>
            }
          >
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

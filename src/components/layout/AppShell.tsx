"use client";

import { useState } from "react";
import type { Family, FamilyMember } from "@/types";
import { Breadcrumbs } from "./Breadcrumbs";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface AppShellProps {
  user: { uid: string; email: string };
  family: Family;
  members: FamilyMember[];
  children: React.ReactNode;
}

export function AppShell({ user, family, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:block">
        <Sidebar family={family} />
      </div>

      {sidebarOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full z-30 md:hidden">
            <Sidebar family={family} onNavigate={() => setSidebarOpen(false)} />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header user={user} family={family} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}

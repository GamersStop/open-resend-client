import React from "react";
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { logoutAction } from "@/lib/actions/auth";
import {
  Mail,
  Inbox,
  Send,
  Star,
  Archive,
  Trash2,
  Settings,
  LogOut,
  ShieldCheck,
  PlusCircle,
  Layers,
  ChevronDown,
} from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.userId },
    include: {
      accounts: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const unreadCount = await db.thread.count({
    where: {
      account: { userId: user.id },
      isRead: false,
      isTrash: false,
    },
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/70 flex flex-col shrink-0 select-none backdrop-blur-md">
        {/* Workspace Brand / Selector */}
        <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Mail className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-white">
                  Open<span className="text-indigo-400">Resend</span>
                </span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  v0.1
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[120px]">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        {/* Compose Button */}
        <div className="p-3">
          <button className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white font-medium text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer">
            <PlusCircle className="h-4 w-4" />
            <span>New Message</span>
          </button>
        </div>

        {/* Navigation Folders */}
        <div className="px-3 py-2 flex-1 overflow-y-auto space-y-6">
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              Mailbox
            </div>
            <nav className="space-y-0.5">
              <a
                href="/"
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Inbox className="h-4 w-4 text-indigo-400" />
                  <span>Inbox</span>
                </div>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </a>

              <a
                href="#starred"
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Star className="h-4 w-4 text-amber-400/80" />
                  <span>Starred</span>
                </div>
              </a>

              <a
                href="#sent"
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Send className="h-4 w-4 text-slate-400" />
                  <span>Sent</span>
                </div>
              </a>

              <a
                href="#archive"
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Archive className="h-4 w-4 text-slate-400" />
                  <span>Archive</span>
                </div>
              </a>

              <a
                href="#trash"
                className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="h-4 w-4 text-slate-400" />
                  <span>Trash</span>
                </div>
              </a>
            </nav>
          </div>

          {/* Connected Resend Accounts */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Accounts ({user.accounts.length})
              </span>
              <Layers className="h-3.5 w-3.5 text-slate-500" />
            </div>

            <div className="space-y-1">
              {user.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-800 text-xs hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-slate-200 truncate">
                      {acc.label}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {acc.defaultFromEmail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Security & Logout Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50 space-y-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">AES-256 Encryption Active</span>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </span>
              <span className="text-[10px] text-slate-500">v0.1</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>Unified Inbox</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <span className="text-xs text-slate-500">
              PostgreSQL / SQLite Storage Engine Active
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-200">{user.email}</p>
              <p className="text-[10px] text-emerald-400">Authenticated Session</p>
            </div>
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-white/20">
              {user.email.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Dashboard Dynamic Child View */}
        <main className="flex-1 min-h-0 overflow-hidden flex">{children}</main>
      </div>
    </div>
  );
}

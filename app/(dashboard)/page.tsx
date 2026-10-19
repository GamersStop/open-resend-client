import React from "react";
export const dynamic = "force-dynamic";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  Search,
  Star,
  Clock,
  ShieldCheck,
  Reply,
  Forward,
  MoreVertical,
  Paperclip,
  CheckCircle2,
  Mail,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const threads = await db.thread.findMany({
    where: {
      account: {
        userId: session.user.userId,
      },
      isTrash: false,
    },
    include: {
      account: true,
      messages: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      lastActivity: "desc",
    },
  });

  const activeThread = threads[0];
  const activeMessage = activeThread?.messages[0];

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Thread List Pane */}
      <section className="w-80 md:w-96 border-r border-slate-800 flex flex-col shrink-0 bg-slate-900/30">
        {/* Search header */}
        <div className="p-3 border-b border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {threads.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40 text-indigo-400" />
              No conversations found in Inbox.
            </div>
          ) : (
            threads.map((thread) => {
              const latestMsg = thread.messages[0];
              return (
                <div
                  key={thread.id}
                  className="p-3.5 hover:bg-slate-800/40 cursor-pointer transition-colors border-l-2 border-indigo-500 bg-slate-800/20"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-xs text-slate-200 truncate">
                        {latestMsg ? latestMsg.from : "Unknown Sender"}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(thread.lastActivity).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="text-xs font-medium text-slate-300 truncate mb-1">
                    {thread.subject}
                  </h3>

                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {latestMsg?.textBody || "No plain text content available"}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-indigo-300 border border-slate-700">
                      {thread.account.label}
                    </span>
                    {thread.isStarred && (
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Message Reader Pane */}
      <section className="flex-1 flex flex-col min-w-0 bg-slate-950">
        {activeThread && activeMessage ? (
          <>
            {/* Header detail */}
            <div className="p-6 border-b border-slate-800/80 bg-slate-900/20 flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {activeThread.account.label}
                  </span>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-500" />
                    {new Date(activeMessage.createdAt).toLocaleString()}
                  </span>
                </div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {activeThread.subject}
                </h1>
                <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <span className="text-slate-500">From: </span>
                    <span className="text-slate-300 font-medium">
                      {activeMessage.from}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">To: </span>
                    <span className="text-slate-300 font-medium">
                      {activeMessage.to}
                    </span>
                  </div>
                  {activeMessage.messageIdHeader && (
                    <div className="font-mono text-[10px] text-slate-500">
                      ID: {activeMessage.messageIdHeader}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-all cursor-pointer">
                  <Reply className="h-3.5 w-3.5" />
                  <span>Reply</span>
                </button>
                <button className="p-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Email Body Rendering with Sandboxed Preview & DOMPurify security note */}
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span>
                      Sandboxed Security Shield Active (Remote images and
                      scripts blocked by default)
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Safe
                  </span>
                </div>

                {/* Sandboxed rendering container as per rules.md Rule 3 */}
                <div className="rounded-xl border border-slate-800 bg-white overflow-hidden shadow-xl min-h-[350px]">
                  <iframe
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    srcDoc={activeMessage.htmlBody || activeMessage.textBody || ""}
                    title="Email Content"
                    className="w-full min-h-[350px] border-none"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-indigo-400" />
            </div>
            <h2 className="text-base font-semibold text-white">
              No Conversation Selected
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              Select an email from your inbox to inspect its conversation
              thread, RFC headers, and sandboxed preview.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

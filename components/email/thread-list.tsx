"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SerializedThread } from "./thread-view";
import {
  toggleStarAction,
  toggleReadAction,
  archiveThreadsAction,
  trashThreadsAction,
  restoreToInboxAction,
  permanentDeleteThreadsAction,
} from "@/lib/actions/threads";
import {
  Search,
  Star,
  Mail,
  Archive,
  Trash2,
  CheckSquare,
  Square,
  Clock,
  RotateCcw,
  Check,
  Filter,
} from "lucide-react";

interface ThreadListProps {
  threads: SerializedThread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  currentFolder: string;
}

export function ThreadList({
  threads,
  selectedThreadId,
  onSelectThread,
  currentFolder,
}: ThreadListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter threads client-side by search query if typed
  const filteredThreads = threads.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const latestMsg = t.messages[0];
    return (
      t.subject.toLowerCase().includes(q) ||
      (latestMsg && latestMsg.from.toLowerCase().includes(q)) ||
      (latestMsg && latestMsg.textBody?.toLowerCase().includes(q))
    );
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    } else {
      params.delete("q");
    }
    router.push(`/?${params.toString()}`);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredThreads.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredThreads.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleStar = async (id: string, currentStarred: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleStarAction(id, !currentStarred);
    router.refresh();
  };

  // Bulk actions
  const handleBulkRead = async (isRead: boolean) => {
    if (selectedIds.length === 0) return;
    await toggleReadAction(selectedIds, isRead);
    setSelectedIds([]);
    router.refresh();
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    await archiveThreadsAction(selectedIds);
    setSelectedIds([]);
    router.refresh();
  };

  const handleBulkTrash = async () => {
    if (selectedIds.length === 0) return;
    await trashThreadsAction(selectedIds);
    setSelectedIds([]);
    router.refresh();
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    await restoreToInboxAction(selectedIds);
    setSelectedIds([]);
    router.refresh();
  };

  const handleBulkPermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Permanently delete ${selectedIds.length} conversations?`)) {
      await permanentDeleteThreadsAction(selectedIds);
      setSelectedIds([]);
      router.refresh();
    }
  };

  return (
    <section className="w-80 md:w-96 border-r border-slate-800 flex flex-col shrink-0 bg-slate-900/40">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject or sender..."
            className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </form>

        {/* Bulk Action / Selection Toolbar */}
        <div className="flex items-center justify-between px-1 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 hover:text-slate-200 transition-colors cursor-pointer"
            >
              {selectedIds.length > 0 && selectedIds.length === filteredThreads.length ? (
                <CheckSquare className="h-4 w-4 text-indigo-400" />
              ) : (
                <Square className="h-4 w-4 text-slate-500" />
              )}
              <span className="text-[11px]">
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select All"}
              </span>
            </button>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1 animate-in fade-in duration-100">
              <button
                onClick={() => handleBulkRead(true)}
                title="Mark Read"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleBulkRead(false)}
                title="Mark Unread"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>

              {currentFolder !== "archive" && currentFolder !== "trash" && (
                <button
                  onClick={handleBulkArchive}
                  title="Archive"
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
              )}

              {currentFolder !== "trash" ? (
                <button
                  onClick={handleBulkTrash}
                  title="Move to Trash"
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <>
                  <button
                    onClick={handleBulkRestore}
                    title="Restore to Inbox"
                    className="p-1.5 rounded hover:bg-slate-800 text-emerald-400"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleBulkPermanentDelete}
                    title="Permanent Delete"
                    className="p-1.5 rounded hover:bg-slate-800 text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Thread List Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
        {filteredThreads.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Mail className="h-8 w-8 mx-auto mb-2 opacity-40 text-indigo-400" />
            <p>No conversations found in {currentFolder}.</p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const isSelected = thread.id === selectedThreadId;
            const isChecked = selectedIds.includes(thread.id);
            const latestMsg = thread.messages[thread.messages.length - 1];

            return (
              <div
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`p-3.5 cursor-pointer transition-all border-l-2 select-none ${
                  isSelected
                    ? "bg-slate-800/60 border-indigo-500"
                    : !thread.isRead
                    ? "bg-slate-800/25 border-indigo-400 hover:bg-slate-800/40"
                    : "border-transparent hover:bg-slate-800/20"
                }`}
              >
                {/* Top sender line */}
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={(e) => toggleSelectOne(thread.id, e)}
                      className="text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {isChecked ? (
                        <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                      ) : (
                        <Square className="h-3.5 w-3.5 text-slate-600" />
                      )}
                    </button>

                    {!thread.isRead && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                    )}

                    <span
                      className={`text-xs truncate ${
                        !thread.isRead
                          ? "font-bold text-white"
                          : "font-medium text-slate-300"
                      }`}
                    >
                      {latestMsg ? latestMsg.from : "Unknown"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => handleToggleStar(thread.id, thread.isStarred, e)}
                      className="text-slate-500 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Star
                        className={`h-3 w-3 ${
                          thread.isStarred ? "text-amber-400 fill-amber-400" : ""
                        }`}
                      />
                    </button>

                    <span className="text-[10px] text-slate-500">
                      {new Date(thread.lastActivity).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Subject */}
                <h3
                  className={`text-xs truncate mb-1 ${
                    !thread.isRead
                      ? "font-semibold text-slate-100"
                      : "text-slate-300 font-normal"
                  }`}
                >
                  {thread.subject}
                </h3>

                {/* Snippet */}
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {latestMsg?.textBody || "HTML Message"}
                </p>

                {/* Footer Badges */}
                <div className="mt-2.5 flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-800 text-indigo-300 border border-slate-700">
                    {thread.account.label}
                  </span>
                  {thread.messages.length > 1 && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {thread.messages.length} msgs
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

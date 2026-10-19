"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SandboxedViewer } from "./sandboxed-viewer";
import { useComposer } from "./composer-context";
import {
  toggleStarAction,
  toggleReadAction,
  archiveThreadsAction,
  trashThreadsAction,
  restoreToInboxAction,
  permanentDeleteThreadsAction,
} from "@/lib/actions/threads";
import {
  Star,
  Mail,
  Archive,
  Trash2,
  Reply,
  MoreVertical,
  Paperclip,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  CheckCircle,
  RotateCcw,
} from "lucide-react";

export interface SerializedAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
}

export interface SerializedMessage {
  id: string;
  direction: string;
  from: string;
  to: string; // JSON serialized
  cc: string | null;
  bcc: string | null;
  subject: string;
  htmlBody: string | null;
  textBody: string | null;
  messageIdHeader: string | null;
  createdAt: string;
  attachments?: SerializedAttachment[];
}

export interface SerializedThread {
  id: string;
  subject: string;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isTrash: boolean;
  lastActivity: string;
  account: {
    id: string;
    label: string;
    defaultFromEmail: string;
  };
  messages: SerializedMessage[];
}

interface ThreadViewProps {
  thread: SerializedThread;
  onBack?: () => void;
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return [raw];
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function ThreadView({ thread, onBack }: ThreadViewProps) {
  const router = useRouter();
  const [isStarred, setIsStarred] = useState(thread.isStarred);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Record<string, boolean>>(() => {
    // By default expand the newest message (last in array)
    const initial: Record<string, boolean> = {};
    if (thread.messages.length > 0) {
      initial[thread.messages[thread.messages.length - 1].id] = true;
    }
    return initial;
  });

  const toggleExpand = (messageId: string) => {
    setExpandedMessageIds((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleStar = async () => {
    const nextState = !isStarred;
    setIsStarred(nextState);
    await toggleStarAction(thread.id, nextState);
    router.refresh();
  };

  const handleMarkUnread = async () => {
    await toggleReadAction([thread.id], false);
    router.refresh();
  };

  const handleArchive = async () => {
    await archiveThreadsAction([thread.id]);
    router.refresh();
  };

  const handleTrash = async () => {
    await trashThreadsAction([thread.id]);
    router.refresh();
  };

  const handleRestore = async () => {
    await restoreToInboxAction([thread.id]);
    router.refresh();
  };

  const handlePermanentDelete = async () => {
    if (confirm("Are you sure you want to permanently delete this conversation?")) {
      await permanentDeleteThreadsAction([thread.id]);
      router.refresh();
    }
  };

  const { openComposer } = useComposer();

  const handleReply = (replyAll: boolean = false) => {
    const lastMsg = thread.messages[thread.messages.length - 1];
    const originalSender = lastMsg ? lastMsg.from : thread.account.defaultFromEmail;
    const match = originalSender.match(/<([^>]+)>/);
    const targetEmail = match ? match[1] : originalSender.trim();

    let ccList: string[] = [];
    if (replyAll && lastMsg) {
      const origToList = parseJsonArray(lastMsg.to);
      const origCcList = parseJsonArray(lastMsg.cc);
      ccList = [...origToList, ...origCcList].filter(
        (addr) =>
          addr.toLowerCase() !== thread.account.defaultFromEmail.toLowerCase() &&
          addr.toLowerCase() !== targetEmail.toLowerCase()
      );
    }

    openComposer({
      threadId: thread.id,
      accountId: thread.account.id,
      to: [targetEmail],
      cc: ccList.length > 0 ? ccList : undefined,
      subject: thread.subject,
      inReplyTo: lastMsg?.messageIdHeader || "",
      references: lastMsg?.messageIdHeader || "",
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Thread Action Bar Header */}
      <div className="h-14 px-6 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors md:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={handleStar}
            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
            title={isStarred ? "Unstar" : "Star"}
          >
            <Star
              className={`h-4 w-4 ${
                isStarred ? "text-amber-400 fill-amber-400" : ""
              }`}
            />
          </button>

          <button
            onClick={handleMarkUnread}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Mark as Unread"
          >
            <Mail className="h-4 w-4" />
          </button>

          {!thread.isArchived && !thread.isTrash && (
            <button
              onClick={handleArchive}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}

          {!thread.isTrash ? (
            <button
              onClick={handleTrash}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
              title="Move to Trash"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                onClick={handleRestore}
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors cursor-pointer"
                title="Restore to Inbox"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={handlePermanentDelete}
                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                title="Delete Permanently"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}

          <span className="h-4 w-px bg-slate-800 mx-1" />

          <button
            onClick={() => handleReply(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            title="Reply"
          >
            <Reply className="h-3.5 w-3.5" />
            <span>Reply</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {thread.account.label}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {thread.messages.length}{" "}
            {thread.messages.length === 1 ? "message" : "messages"}
          </span>
        </div>
      </div>

      {/* Conversation Title & Timeline Content */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="pb-3 border-b border-slate-800/80">
            <h1 className="text-xl font-bold text-white tracking-tight">
              {thread.subject}
            </h1>
          </div>

          {/* Messages Timeline (Chronological) */}
          <div className="space-y-4">
            {thread.messages.map((message, index) => {
              const isExpanded = expandedMessageIds[message.id] ?? false;
              const toList = parseJsonArray(message.to);
              const ccList = parseJsonArray(message.cc);
              const isOutbound = message.direction === "OUTBOUND";

              return (
                <div
                  key={message.id}
                  className={`rounded-2xl border transition-all ${
                    isExpanded
                      ? "bg-slate-900/70 border-slate-700/80 shadow-lg shadow-black/40"
                      : "bg-slate-900/30 border-slate-800/80 hover:border-slate-700/60"
                  }`}
                >
                  {/* Message Summary Header */}
                  <div
                    onClick={() => toggleExpand(message.id)}
                    className="p-4 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-sm ${
                          isOutbound
                            ? "bg-gradient-to-tr from-violet-600 to-indigo-600 text-white"
                            : "bg-gradient-to-tr from-slate-700 to-slate-600 text-slate-200"
                        }`}
                      >
                        {message.from.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-slate-100 truncate">
                            {message.from}
                          </span>
                          <span
                            className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-mono font-semibold ${
                              isOutbound
                                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                            }`}
                          >
                            {message.direction}
                          </span>
                        </div>

                        {!isExpanded && (
                          <p className="text-[11px] text-slate-400 truncate max-w-md">
                            {message.textBody || "HTML formatted content..."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>{message.attachments.length}</span>
                        </div>
                      )}

                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-500" />
                        {new Date(message.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Message Content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-800/80">
                      {/* Detailed Header Fields */}
                      <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/60 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium w-12">
                            To:
                          </span>
                          <span className="text-slate-200">
                            {toList.join(", ")}
                          </span>
                        </div>

                        {ccList.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium w-12">
                              Cc:
                            </span>
                            <span className="text-slate-300">
                              {ccList.join(", ")}
                            </span>
                          </div>
                        )}

                        {message.messageIdHeader && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium w-12">
                              RFC ID:
                            </span>
                            <span className="text-slate-400 font-mono text-[10px] truncate">
                              {message.messageIdHeader}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Sandboxed Body Viewer */}
                      <SandboxedViewer
                        htmlBody={message.htmlBody}
                        textBody={message.textBody}
                      />

                      {/* Attachments Section */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="pt-2">
                          <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                            <Paperclip className="h-3.5 w-3.5 text-indigo-400" />
                            <span>
                              Attachments ({message.attachments.length})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {message.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-medium text-slate-200 truncate">
                                    {att.filename}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {formatBytes(att.size)} • {att.mimeType}
                                  </p>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                  Saved
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Reply Bar */}
          <div
            onClick={() => handleReply(false)}
            className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/80 hover:border-indigo-500/40 cursor-pointer transition-all flex items-center justify-between text-xs text-slate-400 group select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-500/20">
                <Reply className="h-4 w-4" />
              </div>
              <span className="group-hover:text-slate-200 transition-colors">
                Click here to reply to this conversation...
              </span>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 group-hover:text-indigo-300 group-hover:bg-slate-700 transition-colors">
              Reply
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

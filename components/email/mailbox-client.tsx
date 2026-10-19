"use client";

import React, { useState, useEffect } from "react";
import { ThreadList } from "./thread-list";
import { ThreadView, SerializedThread } from "./thread-view";
import { toggleReadAction } from "@/lib/actions/threads";
import { Mail, Inbox, InboxIcon } from "lucide-react";

interface MailboxClientProps {
  threads: SerializedThread[];
  initialThreadId?: string;
  currentFolder: string;
}

export function MailboxClient({
  threads,
  initialThreadId,
  currentFolder,
}: MailboxClientProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId || (threads.length > 0 ? threads[0].id : null)
  );

  useEffect(() => {
    // If threads change or current selected is not in threads, update selection
    if (threads.length > 0) {
      if (!selectedThreadId || !threads.some((t) => t.id === selectedThreadId)) {
        setSelectedThreadId(threads[0].id);
      }
    } else {
      setSelectedThreadId(null);
    }
  }, [threads]);

  const handleSelectThread = async (id: string) => {
    setSelectedThreadId(id);
    const target = threads.find((t) => t.id === id);
    if (target && !target.isRead) {
      target.isRead = true;
      await toggleReadAction([id], true);
    }
  };

  const selectedThread = threads.find((t) => t.id === selectedThreadId);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Thread list */}
      <ThreadList
        threads={threads}
        selectedThreadId={selectedThreadId}
        onSelectThread={handleSelectThread}
        currentFolder={currentFolder}
      />

      {/* Reader / Empty State */}
      {selectedThread ? (
        <ThreadView
          thread={selectedThread}
          onBack={() => setSelectedThreadId(null)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-950">
          <div className="h-16 w-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-indigo-400" />
          </div>
          <h2 className="text-base font-semibold text-white">
            No Conversation Selected
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Choose a thread from the list to view its messages, sandboxed
            previews, and conversation timeline.
          </p>
        </div>
      )}
    </div>
  );
}

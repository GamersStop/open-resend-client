"use client";

import React, { createContext, useContext, useState } from "react";

export interface ReplyContextPayload {
  threadId: string;
  accountId: string;
  to: string[];
  cc?: string[];
  subject: string;
  inReplyTo: string;
  references: string;
}

interface ComposerContextType {
  isOpen: boolean;
  replyContext: ReplyContextPayload | null;
  openComposer: (reply?: ReplyContextPayload) => void;
  closeComposer: () => void;
}

const ComposerContext = createContext<ComposerContextType | undefined>(undefined);

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<ReplyContextPayload | null>(null);

  const openComposer = (reply?: ReplyContextPayload) => {
    setReplyContext(reply || null);
    setIsOpen(true);
  };

  const closeComposer = () => {
    setIsOpen(false);
    setReplyContext(null);
  };

  return (
    <ComposerContext.Provider
      value={{
        isOpen,
        replyContext,
        openComposer,
        closeComposer,
      }}
    >
      {children}
    </ComposerContext.Provider>
  );
}

export function useComposer() {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error("useComposer must be used within a ComposerProvider");
  }
  return context;
}

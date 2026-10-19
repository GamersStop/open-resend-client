"use client";

import React from "react";
import { useComposer } from "@/components/email/composer-context";
import { PlusCircle } from "lucide-react";

export function ComposeButton() {
  const { openComposer } = useComposer();

  return (
    <button
      onClick={() => openComposer()}
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.99] text-white font-medium text-xs shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
    >
      <PlusCircle className="h-4 w-4" />
      <span>New Message</span>
    </button>
  );
}

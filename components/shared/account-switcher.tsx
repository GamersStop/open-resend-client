"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useAccountContext } from "./account-context";
import {
  ChevronDown,
  Layers,
  Check,
  Plus,
  Settings,
  Mail,
  ShieldCheck,
} from "lucide-react";

export function AccountSwitcher() {
  const { accounts, activeAccountId, setActiveAccountId, activeAccount } =
    useAccountContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-2.5 transition-all shadow-sm cursor-pointer"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            activeAccountId === "all"
              ? "bg-indigo-400 animate-pulse"
              : "bg-emerald-400"
          }`}
        />
        <span className="font-semibold text-slate-100 max-w-[150px] truncate">
          {activeAccountId === "all"
            ? "Unified Inbox"
            : activeAccount?.label || "Select Account"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/80 py-2 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Workspace Inboxes
          </div>

          {/* Unified Inbox Option */}
          <button
            onClick={() => {
              setActiveAccountId("all");
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-800/60 transition-colors ${
              activeAccountId === "all"
                ? "text-indigo-400 bg-indigo-500/10 font-medium"
                : "text-slate-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
              <div>
                <div className="font-medium">Unified Inbox</div>
                <div className="text-[10px] text-slate-400">
                  All {accounts.length} connected domains
                </div>
              </div>
            </div>
            {activeAccountId === "all" && <Check className="h-3.5 w-3.5 text-indigo-400" />}
          </button>

          <div className="my-1.5 border-t border-slate-800" />

          {/* Individual Accounts */}
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {accounts.map((acc) => {
              const isSelected = activeAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    setActiveAccountId(acc.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-800/60 transition-colors ${
                    isSelected
                      ? "text-emerald-400 bg-emerald-500/10 font-medium"
                      : "text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{acc.label}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {acc.defaultFromEmail}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="my-1.5 border-t border-slate-800" />

          {/* Manage Accounts link */}
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="px-3 py-2 flex items-center gap-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Settings className="h-4 w-4 text-slate-400" />
            <span>Manage Accounts & Webhooks</span>
          </Link>
        </div>
      )}
    </div>
  );
}

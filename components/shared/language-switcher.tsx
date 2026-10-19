"use client";

import React, { useState, useRef, useEffect } from "react";
import { useI18n, SUPPORTED_LOCALES, SupportedLocale } from "./i18n-context";
import { Globe, Check, ChevronDown } from "lucide-react";

interface LanguageSwitcherProps {
  placement?: "up" | "down";
  compact?: boolean;
}

export function LanguageSwitcher({
  placement = "up",
  compact = false,
}: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentOption =
    SUPPORTED_LOCALES.find((l) => l.code === locale) || SUPPORTED_LOCALES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2 truncate">
          <Globe className="h-3.5 w-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
          <span className="text-xs">{currentOption.flag}</span>
          {!compact && (
            <span className="truncate text-slate-300 group-hover:text-white">
              {currentOption.nativeLabel}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 w-full z-50 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/80 py-1.5 focus:outline-none animate-in fade-in zoom-in-95 duration-100 ${
            placement === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          <div className="px-3 py-1 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800/60 mb-1">
            Select Language
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 px-1">
            {SUPPORTED_LOCALES.map((item) => {
              const isSelected = item.code === locale;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setLocale(item.code as SupportedLocale);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.flag}</span>
                    <span className="font-medium">{item.nativeLabel}</span>
                    <span className="text-[10px] text-slate-400">
                      ({item.label})
                    </span>
                  </div>
                  {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

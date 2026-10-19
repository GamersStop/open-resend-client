"use client";

import React, { useActionState } from "react";
import Link from "next/link";
import { setupAction, ActionState } from "@/lib/actions/auth";
import { Lock, Mail, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";

export default function SetupPage() {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    setupAction,
    {}
  );

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-white tracking-tight">
          Initialize OpenResend
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Create your primary administrative master credentials
        </p>
      </div>

      {state?.error && (
        <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Admin Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="admin@domain.com"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          {state?.fieldErrors?.email && (
            <p className="text-xs text-rose-400 mt-1">
              {state.fieldErrors.email}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Master Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          {state?.fieldErrors?.password && (
            <p className="text-xs text-rose-400 mt-1">
              {state.fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-xs font-medium text-slate-300 mb-1.5"
          >
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              placeholder="Re-enter master password"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>
          {state?.fieldErrors?.confirmPassword && (
            <p className="text-xs text-rose-400 mt-1">
              {state.fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/60 text-xs text-slate-400 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>
            Passwords are salted and hashed using bcrypt. Sensitive Resend keys
            are encrypted via AES-256-GCM.
          </span>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-medium text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Provisioning Instance...</span>
            </>
          ) : (
            <>
              <span>Initialize Workspace</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-400">
          Already initialized?{" "}
          <Link
            href="/login"
            className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

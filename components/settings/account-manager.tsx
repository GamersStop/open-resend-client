"use client";

import React, { useState, useActionState } from "react";
import {
  createAccountAction,
  updateAccountAction,
  deleteAccountAction,
  SafeAccount,
  AccountActionState,
} from "@/lib/actions/accounts";
import {
  Plus,
  Copy,
  Check,
  Trash2,
  Edit2,
  ShieldCheck,
  Webhook,
  ExternalLink,
  Layers,
  KeyRound,
  Mail,
  Loader2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/shared/language-switcher";

interface AccountManagerProps {
  accounts: SafeAccount[];
  appUrl: string;
}

export function AccountManager({ accounts, appUrl }: AccountManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SafeAccount | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [createState, createAction, isCreating] = useActionState<
    AccountActionState,
    FormData
  >(async (prev, formData) => {
    const res = await createAccountAction(prev, formData);
    if (res.success) {
      setIsAdding(false);
    }
    return res;
  }, {});

  const [updateState, editAction, isUpdating] = useActionState<
    AccountActionState,
    FormData
  >(async (prev, formData) => {
    const res = await updateAccountAction(prev, formData);
    if (res.success) {
      setEditingAccount(null);
    }
    return res;
  }, {});

  const handleCopyUrl = (token: string) => {
    const fullUrl = `${appUrl}/api/webhooks/resend/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this account? All associated email threads will be permanently removed."
      )
    ) {
      return;
    }
    setDeletingId(id);
    await deleteAccountAction(id);
    setDeletingId(null);
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="h-5 w-5 text-indigo-400" />
            <span>Connected Resend Accounts</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure isolated Resend API keys, outbound default sender
            identities, and inbound webhook endpoints.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="w-36 sm:w-44">
            <LanguageSwitcher placement="down" />
          </div>
          <button
            onClick={() => {
              setIsAdding(true);
              setEditingAccount(null);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      {/* Add Account Modal / Panel */}
      {isAdding && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-indigo-500/30 shadow-xl shadow-black/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-white">
                Add New Resend Account
              </h2>
            </div>
            <button
              onClick={() => setIsAdding(false)}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {createState?.error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createState.error}</span>
            </div>
          )}

          <form action={createAction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Account Display Label *
                </label>
                <input
                  name="label"
                  required
                  placeholder="e.g. Acme Corp Support"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {createState?.fieldErrors?.label && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    {createState.fieldErrors.label}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Resend API Key (re_...) *
                </label>
                <input
                  name="apiKey"
                  type="password"
                  required
                  placeholder="re_123456789_abcdef"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {createState?.fieldErrors?.apiKey && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    {createState.fieldErrors.apiKey}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Sender Email Address *
                </label>
                <input
                  name="defaultFromEmail"
                  type="email"
                  required
                  placeholder="hello@yourdomain.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {createState?.fieldErrors?.defaultFromEmail && (
                  <p className="text-[11px] text-rose-400 mt-1">
                    {createState.fieldErrors.defaultFromEmail}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Sender Name (Optional)
                </label>
                <input
                  name="defaultFromName"
                  placeholder="Acme Support"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Webhook Signing Secret (Optional)
              </label>
              <input
                name="webhookSecret"
                placeholder="whsec_... (leave empty to auto-generate)"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Used to verify inbound payload authenticity from Resend.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Validating Key & Provisioning...</span>
                  </>
                ) : (
                  <span>Save Account</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Account Modal / Panel */}
      {editingAccount && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/30 shadow-xl shadow-black/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Edit2 className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-white">
                Edit {editingAccount.label}
              </h2>
            </div>
            <button
              onClick={() => setEditingAccount(null)}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {updateState?.error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{updateState.error}</span>
            </div>
          )}

          <form action={editAction} className="space-y-4">
            <input type="hidden" name="accountId" value={editingAccount.id} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Account Display Label *
                </label>
                <input
                  name="label"
                  required
                  defaultValue={editingAccount.label}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Update API Key (Leave blank to keep existing)
                </label>
                <input
                  name="apiKey"
                  type="password"
                  placeholder="re_••••••••••••"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Sender Email Address *
                </label>
                <input
                  name="defaultFromEmail"
                  type="email"
                  required
                  defaultValue={editingAccount.defaultFromEmail}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Default Sender Name
                </label>
                <input
                  name="defaultFromName"
                  defaultValue={editingAccount.defaultFromName || ""}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow-md shadow-amber-600/25 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update Account</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account Cards List */}
      <div className="grid grid-cols-1 gap-5">
        {accounts.map((acc) => {
          const webhookUrl = `${appUrl}/api/webhooks/resend/${acc.webhookToken}`;
          const isCopied = copiedToken === acc.webhookToken;
          const isDeleting = deletingId === acc.id;

          return (
            <div
              key={acc.id}
              className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700/80 transition-all shadow-md space-y-4"
            >
              {/* Account header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">
                        {acc.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Default sender:{" "}
                      <span className="text-slate-200">
                        {acc.defaultFromName
                          ? `${acc.defaultFromName} <${acc.defaultFromEmail}>`
                          : acc.defaultFromEmail}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      setEditingAccount(acc);
                      setIsAdding(false);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Edit Account"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(acc.id)}
                    disabled={isDeleting}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                    title="Delete Account"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Inbound Webhook Box */}
              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-300">
                    <Webhook className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Inbound Webhook Endpoint</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Token: {acc.webhookToken.slice(0, 10)}...
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={webhookUrl}
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-mono text-indigo-300 select-all focus:outline-none"
                  />
                  <button
                    onClick={() => handleCopyUrl(acc.webhookToken)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors cursor-pointer shrink-0"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resend Setup Guide Card */}
      <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-3">
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <HelpCircle className="h-4 w-4 text-indigo-400" />
          <span>How to connect Resend Inbound Routing</span>
        </div>
        <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed">
          <li>
            Open the{" "}
            <a
              href="https://resend.com/webhooks"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:underline inline-flex items-center gap-0.5"
            >
              Resend Dashboard Webhooks page
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            .
          </li>
          <li>
            Click <strong>Add Webhook</strong> and paste the generated Inbound
            Webhook URL above into the Endpoint URL field.
          </li>
          <li>
            Subscribe to the <strong>email.received</strong> or{" "}
            <strong>inbound</strong> events.
          </li>
          <li>
            Ensure your custom domain has its MX records pointed to Resend
            according to Resend's Inbound setup instructions.
          </li>
        </ol>
      </div>
    </div>
  );
}

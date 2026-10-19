"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SafeAccount } from "@/lib/actions/accounts";

interface AccountContextType {
  accounts: SafeAccount[];
  activeAccountId: string; // 'all' for Unified Inbox, or specific accountId
  setActiveAccountId: (id: string) => void;
  activeAccount: SafeAccount | null;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

const STORAGE_KEY = "openresend_active_account_id";

export function AccountProvider({
  children,
  initialAccounts,
}: {
  children: React.ReactNode;
  initialAccounts: SafeAccount[];
}) {
  const [accounts, setAccounts] = useState<SafeAccount[]>(initialAccounts);
  const [activeAccountId, setActiveAccountIdState] = useState<string>("all");

  useEffect(() => {
    setAccounts(initialAccounts);
  }, [initialAccounts]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (saved === "all" || initialAccounts.some((a) => a.id === saved))) {
      setActiveAccountIdState(saved);
      document.cookie = `openresend_active_account=${saved}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [initialAccounts]);

  const setActiveAccountId = (id: string) => {
    setActiveAccountIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
    document.cookie = `openresend_active_account=${id}; path=/; max-age=31536000; SameSite=Lax`;
    // Refresh page to sync server state if necessary
    window.location.reload();
  };

  const activeAccount =
    activeAccountId === "all"
      ? null
      : accounts.find((a) => a.id === activeAccountId) || null;

  return (
    <AccountContext.Provider
      value={{
        accounts,
        activeAccountId,
        setActiveAccountId,
        activeAccount,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}

export function useAccountContext() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccountContext must be used within an AccountProvider");
  }
  return context;
}

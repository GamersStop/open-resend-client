import React from "react";
export const dynamic = "force-dynamic";
import { getSession } from "@/lib/auth";
import { getSafeAccounts } from "@/lib/actions/accounts";
import { redirect } from "next/navigation";
import { AccountManager } from "@/components/settings/account-manager";
import { headers } from "next/headers";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const accounts = await getSafeAccounts();

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <AccountManager accounts={accounts} appUrl={appUrl} />
    </div>
  );
}

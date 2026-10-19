import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OpenResend | Self-Hosted Resend Webmail Client",
  description:
    "Lightweight, multi-account, self-hosted webmail client built specifically for Resend APIs.",
};

import { I18nProvider } from "@/components/shared/i18n-context";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}

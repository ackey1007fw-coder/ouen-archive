import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "応援アーカイブ",
  title: "応援アーカイブ｜夢と活動の記録",
  description:
    "夢と活動の記録をたどりながら、5つの個人応援サイトへつなぐファン制作の非公式ポータルです。",
  openGraph: {
    title: "応援アーカイブ｜夢と活動の記録",
    description:
      "夢と活動の記録をたどりながら、5つの個人応援サイトへつなぐ非公式ポータル。",
    siteName: "応援アーカイブ",
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "応援アーカイブ｜夢と活動の記録",
    description:
      "夢と活動の記録をたどりながら、5つの個人応援サイトへつなぐ非公式ポータル。",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a className="skip-link" href="#main-content">
          本文へ移動
        </a>
        {children}
      </body>
    </html>
  );
}

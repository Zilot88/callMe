import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import MuiProvider from "./MuiProvider";
import { I18nProvider } from "./lib/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CallMe - Video Calls & Chats",
  description: "Secure video calls and group chats in the browser, no signup needed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MuiProvider>
          <I18nProvider>{children}</I18nProvider>
        </MuiProvider>
      </body>
    </html>
  );
}

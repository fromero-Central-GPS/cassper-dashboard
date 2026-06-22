import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Revenue Recovery Dashboard — GHL + Paperclip",
  description: "Dashboard de detección de oportunidades perdidas via GHL MCP + Paperclip Agent. Inspirado en Cassper.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}

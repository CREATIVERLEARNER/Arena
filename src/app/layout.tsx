import type { Metadata, Viewport } from "next";
// Self-hosted via the `geist` package — no external font requests, works offline.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Void — Personal Study Sanctuary",
  description:
    "A hyper-minimalist, distraction-free study sanctuary. A focus timer, ambient soundscapes, and tasks that fade into the void.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-void font-sans text-silver antialiased">
        {children}
      </body>
    </html>
  );
}

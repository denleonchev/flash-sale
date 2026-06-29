import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import "./globals.css";

export const metadata = {
  title: "Flash-Sale",
  description: "Flash-sale platform — web frontend",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-zinc-950 text-zinc-50 antialiased">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

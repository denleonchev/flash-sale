import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { RoleSwitcher } from "./role-switcher";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata = {
  title: "Flash-Sale",
  description: "Flash-sale platform — web frontend",
};

async function RoleSwitcherWrapper() {
  const session = await getSession();
  if (!session) return null;
  const currentRole = session.isAdmin ? "admin" : session.hasRole("moderator") ? "moderator" : "";
  return <RoleSwitcher currentRole={currentRole as "" | "moderator" | "admin"} />;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50 antialiased">
        <SiteHeader />
        {children}
        <RoleSwitcherWrapper />
      </body>
    </html>
  );
}

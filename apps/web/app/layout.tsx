import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { RoleSwitcher } from "./role-switcher";
import { ClientErrorListeners } from "./client-error-listeners";
import { SessionProvider } from "./session-provider";
import { getSession } from "@/lib/session";
import { getSiteUrl } from "@/lib/seo/get-site-url";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo/site";
import "./globals.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: getSiteUrl(),
    title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
    description: SITE_DESCRIPTION,
    openGraph: { type: "website", siteName: SITE_NAME },
    twitter: { card: "summary" },
  };
}

async function RoleSwitcherWrapper() {
  const session = await getSession();
  if (!session) return null;
  const currentRole = session.isAdmin ? "admin" : session.hasRole("moderator") ? "moderator" : "";
  return <RoleSwitcher currentRole={currentRole} />;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50 antialiased">
        <SessionProvider>
          <SiteHeader />
          <div className="w-full max-w-5xl mx-auto px-4 flex-1 flex flex-col">{children}</div>
          <RoleSwitcherWrapper />
        </SessionProvider>
        <ClientErrorListeners />
      </body>
    </html>
  );
}

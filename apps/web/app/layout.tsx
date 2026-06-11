import type { ReactNode } from "react";

export const metadata = {
  title: "Flash-Sale",
  description: "Flash-sale platform — web frontend",
};

/**
 * Root layout (required by the App Router). Skeleton for S-E0.1c — just the
 * html/body shell. Real layout, fonts and providers arrive with the UI in S-1.1.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

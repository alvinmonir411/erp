export const dynamic = 'force-dynamic';
import type { Metadata } from "next";
import "./globals.css";
import { AdminShell } from "@/components/layout/admin-shell";

export const metadata: Metadata = {
  title: "Dealer ERP Admin",
  description: "Frontend for company, product, and stock management",
};

import { Providers } from "@/components/providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>
          <AdminShell>{children}</AdminShell>
        </Providers>
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';
import type { Metadata } from "next";
import "./globals.css";
import { AdminShell } from "@/components/layout/admin-shell";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Dealer ERP Admin",
  description: "Frontend for company, product, and stock management",
};

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
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}

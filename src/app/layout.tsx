import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
export const metadata: Metadata = { title: "Supplier Cert Alerts", description: "Never miss a supplier certificate expiry" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<ClerkProvider><html lang="en"><body className="min-h-screen bg-gray-50 text-gray-900 antialiased">{children}</body></html></ClerkProvider>);
}

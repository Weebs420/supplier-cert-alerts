import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth(); if (!userId) redirect("/sign-in");
  return (<div className="min-h-screen"><nav className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3"><Link href="/dashboard" className="font-bold text-gray-900">Supplier Cert Alerts</Link><div className="flex gap-6 text-sm"><Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Overview</Link><Link href="/dashboard/suppliers" className="text-gray-600 hover:text-gray-900">Suppliers</Link><Link href="/dashboard/certificates" className="text-gray-600 hover:text-gray-900">Certificates</Link><Link href="/dashboard/uploads" className="text-gray-600 hover:text-gray-900">Uploads</Link><Link href="/dashboard/inbox" className="text-gray-600 hover:text-gray-900">Inbox</Link><Link href="/dashboard/alert-rules" className="text-gray-600 hover:text-gray-900">Alert Rules</Link></div></div></nav><main className="mx-auto max-w-6xl px-6 py-8">{children}</main></div>);
}

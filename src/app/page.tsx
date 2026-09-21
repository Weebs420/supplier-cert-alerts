import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
export default async function Home() {
  const { userId } = await auth();
  return (<main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-4xl font-bold tracking-tight">Supplier Cert Alerts</h1><p className="mt-4 text-lg text-gray-600">Upload supplier certificates, let AI extract the key fields, confirm the data, and get email alerts before any cert expires.</p><div className="mt-8 flex gap-4">{userId ? <Link href="/dashboard" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Go to Dashboard</Link> : <><Link href="/sign-in" className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700">Sign in</Link><Link href="/sign-up" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Create account</Link></>}</div></main>);
}

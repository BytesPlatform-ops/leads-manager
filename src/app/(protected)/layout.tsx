import { auth } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { SessionProvider } from "next-auth/react";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar userEmail={session.user?.email} userRole={session.user?.role} />
        <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}

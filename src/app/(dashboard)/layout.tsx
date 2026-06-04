"use client";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Sidebar } from "@/components/shell/sidebar";
import { Header } from "@/components/shell/header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { seedStore } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    seedStore();
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f6f7fb" }}>
      <Sidebar />
      <div className="ml-[272px] flex-1 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

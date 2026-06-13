"use client";
// Redirects to the unified challenge list. The applications tab now lives at
// /hackathons/[challengeId] → Applications tab.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/Loader";

export default function ApplicationsRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/hackathons"); }, [router]);
  return <Loader variant="page" text="Redirecting…" />;
}

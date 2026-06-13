"use client";
// Redirects to the unified challenge list. The leaderboard + judges tabs now
// live at /hackathons/[challengeId] → Leaderboard / Judges tabs.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/Loader";

export default function JudgingRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/hackathons"); }, [router]);
  return <Loader variant="page" text="Redirecting…" />;
}

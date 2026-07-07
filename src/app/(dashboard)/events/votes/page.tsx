"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/Loader";

export default function VoteResultsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/votes"); }, [router]);
  return <Loader variant="page" text="Redirecting…" />;
}

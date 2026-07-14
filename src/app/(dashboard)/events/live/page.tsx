"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SessionList } from "./components/SessionList";
import { SessionDetail } from "./components/SessionDetail";

export default function LiveControlPage() {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  // The URL is the single source of truth for which session is open.
  // Selecting a session PUSHES ?eventId=… (so browser-back returns to the
  // list) and a reload lands back on the same session instead of dumping
  // the host out to the list mid-meeting (previously selection only lived
  // in useState, which a reload wiped).
  const selectedEventId = searchParams.get("eventId");

  if (selectedEventId) {
    return (
      <SessionDetail
        eventId={selectedEventId}
        onBack={() => router.replace(pathname, { scroll: false })}
      />
    );
  }

  return (
    <SessionList
      onSelect={(id) =>
        router.push(`${pathname}?eventId=${encodeURIComponent(id)}`, { scroll: false })
      }
    />
  );
}

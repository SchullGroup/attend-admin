"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SessionList } from "./components/SessionList";
import { SessionDetail } from "./components/SessionDetail";

export default function LiveControlPage() {
  const searchParams                           = useSearchParams();
  const urlEventId                             = searchParams.get("eventId");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(urlEventId);

  // If the URL param changes (e.g. back-button then new link), sync state
  useEffect(() => {
    if (urlEventId) setSelectedEventId(urlEventId);
  }, [urlEventId]);

  if (selectedEventId) {
    return (
      <SessionDetail
        eventId={selectedEventId}
        onBack={() => setSelectedEventId(null)}
      />
    );
  }

  return <SessionList onSelect={setSelectedEventId} />;
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileQuestion } from "lucide-react";

/**
 * Global 404 fallback — rendered whenever Next.js can't match a route.
 * Gives the user clear navigation back to the dashboard instead of a blank error.
 */
export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] px-6">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "hsl(var(--muted))" }}
        >
          <FileQuestion className="h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[hsl(var(--foreground))] mb-2">
          Page not found
        </h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mb-8 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved.
          If you followed a link, it might be outdated.
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors px-4 py-2 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go back
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-white px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: "hsl(var(--primary))" }}
          >
            Dashboard
          </Link>
        </div>

      </div>
    </div>
  );
}

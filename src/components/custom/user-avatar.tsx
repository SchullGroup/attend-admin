"use client";

/**
 * UserAvatar — a person's photo, falling back to their initials.
 *
 * Every user row in the app used to compute initials by hand and render a
 * coloured circle, which is why `avatarUrl` went unnoticed for so long: the
 * backend was returning a photo URL and no screen had an <img> to put it in.
 *
 * The fallback is not optional. Object-storage URLs expire, buckets get
 * re-permissioned, and a broken <img> renders as a torn-page icon that looks
 * far worse than initials ever did — so a load failure silently returns the
 * initials circle rather than leaving a hole in the table.
 */

import { useEffect, useState } from "react";

/**
 * Darken a hex colour toward black.
 *
 * The tinted fallback paints the initials in the API's `avatarColor` on a 13%
 * wash of that same colour. When the API hands back a pastel — and most of the
 * seeded ones are pastels — that is pale text on a paler background, which is
 * why the initials in the attendee tables read as almost blank circles. Mixing
 * the text toward black keeps each person's colour recognisable while making
 * the letters actually legible.
 *
 * Returns null for anything that isn't a plain 3- or 6-digit hex (named
 * colours, hsl(), CSS variables), so the caller falls back to its own default
 * rather than rendering something broken.
 */
function darken(hex: string | null | undefined, amount = 0.45): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const mix = (channel: number) => Math.round(parseInt(h.slice(channel, channel + 2), 16) * (1 - amount));
  return `rgb(${mix(0)}, ${mix(2)}, ${mix(4)})`;
}

interface UserAvatarProps {
  /** Photo URL from the API. Null, empty or broken all fall back to initials. */
  src?: string | null;
  /** Already-computed initials, e.g. "EJ". Shown when there is no usable photo. */
  initials: string;
  /** Per-user accent the API sends for the initials circle (`avatarColor`). */
  color?: string | null;
  /**
   * How `color` paints the initials circle. Both already existed in the app —
   * the participant tables used a tinted chip, the KYC queue and judge lists a
   * solid disc with white text — so both are kept rather than quietly
   * restyling half the screens on the way past.
   */
  variant?: "tint" | "solid";
  /** Explicit background/foreground, for callers with a paired palette of
   *  their own (the team list colours by role, not by person). Wins over `color`. */
  bg?: string;
  fg?: string;
  /** Rendered size in px. Default suits a table row. */
  size?: number;
  className?: string;
}

export function UserAvatar({
  src,
  initials,
  color = null,
  variant = "tint",
  bg,
  fg,
  size = 36,
  className = "",
}: UserAvatarProps) {
  const [broken, setBroken] = useState(false);

  // A new src deserves a fresh attempt — without this, one failure would
  // poison the slot for every user that later scrolls into the same row.
  useEffect(() => setBroken(false), [src]);

  const dimensions = { width: size, height: size };

  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={initials}
        onError={() => setBroken(true)}
        style={dimensions}
        className={`rounded-full object-cover shrink-0 bg-[hsl(var(--muted))] ${className}`}
      />
    );
  }

  const fallbackBg =
    bg ?? (variant === "solid"
      ? (color ?? "#6b7280")
      : (color ? `${color}22` : "hsl(var(--primary)/0.12)"));
  const fallbackFg =
    fg ?? (variant === "solid" ? "#fff" : (darken(color) ?? "hsl(var(--primary))"));

  return (
    <div
      aria-hidden
      style={{
        ...dimensions,
        fontSize: Math.max(10, Math.round(size * 0.36)),
        backgroundColor: fallbackBg,
        color: fallbackFg,
      }}
      className={`rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
}

export default UserAvatar;

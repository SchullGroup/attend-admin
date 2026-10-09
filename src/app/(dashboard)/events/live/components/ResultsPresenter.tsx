"use client";
/**
 * Full-screen "broadcast" view of a resolution's results, for hosts who
 * restream the AGM (YouTube, Zoom, X…) and want viewers to see the tally.
 *
 * - Reads the same live resolution object as the control room, so it keeps
 *   updating while voting is open and freezes on the final result once closed.
 * - Uses the browser Fullscreen API (falls back to a fixed overlay).
 * - Keyboard: Esc closes · ← / → switch resolution.
 * - Controls fade out when the mouse is idle so they don't show on stream.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { LiveResolution } from "@/api/client-live";
import { CachedImage } from "@/components/custom/cached-image";

const FOR = "#22c55e", AGAINST = "#ef4444", ABSTAIN = "#94a3b8";

function initialsOf(name?: string | null) {
  return (name ?? "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function BigBar({ label, color, votes, shares, pct, showShares }: {
  label: string; color: string; votes: number; shares: number; pct: number; showShares: boolean;
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-[clamp(18px,2.2vw,32px)] font-semibold text-white">{label}</span>
        <span className="text-[clamp(28px,4vw,64px)] font-bold tabular-nums leading-none" style={{ color }}>
          {pct.toFixed(pct % 1 === 0 ? 0 : 1)}%
        </span>
      </div>
      <div className="h-[clamp(14px,1.8vw,28px)] rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
      <div className="mt-2 flex gap-6 text-[clamp(13px,1.3vw,20px)] text-white/70 tabular-nums">
        <span><span className="font-semibold text-white">{votes.toLocaleString()}</span> {votes === 1 ? "vote" : "votes"}</span>
        {showShares && (
          <span><span className="font-semibold text-white">{shares.toLocaleString()}</span> {shares === 1 ? "share" : "shares"}</span>
        )}
      </div>
    </div>
  );
}

function MiniBar({ label, color, pct, votes, shares, showShares }: {
  label: string; color: string; pct: number; votes: number; shares: number; showShares: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-[clamp(12px,1.1vw,17px)]">
      <span className="w-[5.5em] text-white/80">{label}</span>
      <div className="flex-1 h-3 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }} />
      </div>
      <span className="w-[3.5em] text-right font-bold tabular-nums" style={{ color }}>{Math.round(pct)}%</span>
      <span className="w-[7em] text-right text-white/60 tabular-nums">
        {showShares ? `${shares.toLocaleString()} sh` : `${votes.toLocaleString()} v`}
      </span>
    </div>
  );
}

export function ResultsPresenter({
  resolutions, activeId, onChangeActive, onClose, eventTitle, registerName, logoUrl,
}: {
  resolutions: LiveResolution[];
  activeId: string;
  onChangeActive: (id: string) => void;
  onClose: () => void;
  eventTitle?: string;
  registerName?: string | null;
  logoUrl?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [idle, setIdle] = useState(false);
  const enteredFs = useRef(false);

  // Only resolutions that have started (open/closed) are presentable.
  const presentable = resolutions.filter((r) => ["OPEN", "CLOSED"].includes((r.status ?? "").toUpperCase()));
  const idx = Math.max(0, presentable.findIndex((r) => r.id === activeId));
  const res = presentable[idx] ?? resolutions.find((r) => r.id === activeId);

  const go = useCallback((delta: number) => {
    if (presentable.length < 2) return;
    const next = presentable[(idx + delta + presentable.length) % presentable.length];
    if (next) onChangeActive(next.id);
  }, [presentable, idx, onChangeActive]);

  // Mount (portal) + enter fullscreen
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted) return;
    const el = rootRef.current;
    if (el && document.fullscreenEnabled && !document.fullscreenElement) {
      el.requestFullscreen?.().then(() => { enteredFs.current = true; }).catch(() => { /* overlay fallback */ });
    }
    const onFs = () => {
      // Browser Esc exits fullscreen — treat that as closing the presenter.
      if (enteredFs.current && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onFs);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Hide controls + cursor after 2.5s without mouse movement
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), 2500); };
    wake();
    window.addEventListener("mousemove", wake);
    return () => { window.removeEventListener("mousemove", wake); clearTimeout(t); };
  }, []);

  if (!mounted || !res) return null;

  const status = (res.status ?? "").toUpperCase();
  const isOpen = status === "OPEN";
  const isClosed = status === "CLOSED";
  const isCandidate = (res.resolutionType ?? "").toUpperCase() === "CANDIDATE" || (res.candidates?.length ?? 0) > 0;

  const fV = res.forCount ?? 0, aV = res.againstCount ?? 0, bV = res.abstainCount ?? 0;
  const tV = fV + aV + bV;
  const fS = res.forShares ?? 0, aS = res.againstShares ?? 0, bS = res.abstainShares ?? 0;
  const tS = fS + aS + bS;
  const shareWeighted = tS > 0 || !!(res as any).shareWeightedTalliesEnabled;
  // Share-weighted AGMs are decided by shares, so percentages follow shares there.
  const base = shareWeighted ? tS : tV;
  const pct = (s: number, v: number) => (base > 0 ? ((shareWeighted ? s : v) / base) * 100 : 0);
  const threshold: number | undefined = (res as any).passThresholdPct ?? (res.tally as any)?.passThresholdPct;
  const passed = res.passed ?? (res.tally as any)?.passed ?? null;

  const overlay = (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-[1000] flex flex-col bg-[#0b1220] text-white ${idle ? "cursor-none" : ""}`}
      style={{ backgroundImage: "radial-gradient(1200px 600px at 10% -10%, rgba(124,34,201,0.25), transparent), radial-gradient(900px 500px at 110% 110%, rgba(34,197,94,0.12), transparent)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Results: ${res.title}`}
    >
      {/* Header — branding + status */}
      <div className="flex items-center justify-between gap-6 px-[4vw] pt-[3vh]">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-[clamp(40px,4.5vw,72px)] w-[clamp(40px,4.5vw,72px)] rounded-2xl overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
            <CachedImage
              src={logoUrl}
              alt={registerName ?? "Logo"}
              className="h-full w-full object-cover"
              fallback={<span className="text-[clamp(14px,1.5vw,24px)] font-bold">{initialsOf(registerName ?? eventTitle)}</span>}
            />
          </div>
          <div className="min-w-0">
            <p className="text-[clamp(16px,1.8vw,28px)] font-bold truncate">{eventTitle}</p>
            {registerName && <p className="text-[clamp(12px,1.2vw,18px)] text-white/60 truncate">{registerName}</p>}
          </div>
        </div>
        <div className="shrink-0">
          {isOpen ? (
            <div className="flex items-center gap-3 rounded-full bg-green-500/15 border border-green-400/40 px-5 py-2">
              <span className="h-3 w-3 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[clamp(13px,1.3vw,20px)] font-bold tracking-wide text-green-300">VOTING LIVE</span>
              {res.secondsRemaining != null && res.secondsRemaining > 0 && (
                <span className="flex items-center gap-1.5 text-[clamp(13px,1.3vw,20px)] font-bold tabular-nums text-white">
                  <Clock className="h-[1em] w-[1em]" />
                  {Math.floor(res.secondsRemaining / 60)}:{String(res.secondsRemaining % 60).padStart(2, "0")}
                </span>
              )}
            </div>
          ) : (
            <div className="rounded-full bg-white/10 border border-white/20 px-5 py-2 text-[clamp(13px,1.3vw,20px)] font-bold tracking-wide">
              FINAL RESULT
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="px-[4vw] mt-[4vh]">
        <p className="text-[clamp(13px,1.3vw,20px)] font-semibold tracking-[0.15em] text-white/60 uppercase">
          Resolution {res.order ?? idx + 1}
          {" · "}{res.specialResolution ? "Special" : "Ordinary"}
          {isCandidate && ` · Candidate poll`}
        </p>
        <h1 className="mt-2 text-[clamp(24px,3.6vw,60px)] font-bold leading-tight line-clamp-3">{res.title}</h1>
      </div>

      {/* Results */}
      <div className="flex-1 min-h-0 px-[4vw] mt-[4vh] overflow-hidden">
        {!isCandidate ? (
          <div className="flex flex-col gap-[3.5vh] max-w-[1400px]">
            <BigBar label="For"     color={FOR}     votes={fV} shares={fS} pct={pct(fS, fV)} showShares={shareWeighted} />
            <BigBar label="Against" color={AGAINST} votes={aV} shares={aS} pct={pct(aS, aV)} showShares={shareWeighted} />
            <BigBar label="Abstain" color={ABSTAIN} votes={bV} shares={bS} pct={pct(bS, bV)} showShares={shareWeighted} />
          </div>
        ) : (
          <div className="grid gap-[2vw]" style={{ gridTemplateColumns: `repeat(${Math.min(3, res.candidates?.length ?? 1)}, minmax(0, 1fr))` }}>
            {(res.candidates ?? []).map((c, ci) => {
              const cfV = c.forCount ?? 0, caV = c.againstCount ?? 0, cbV = c.abstainCount ?? 0;
              const cfS = c.forShares ?? 0, caS = c.againstShares ?? 0, cbS = c.abstainShares ?? 0;
              const cSW = shareWeighted || cfS + caS + cbS > 0;
              const cBase = cSW ? cfS + caS + cbS : cfV + caV + cbV;
              const cp = (s: number, v: number) => (cBase > 0 ? ((cSW ? s : v) / cBase) * 100 : 0);
              return (
                <div key={c.id ?? ci} className="rounded-2xl bg-white/5 border border-white/10 p-[1.5vw]">
                  <p className="text-[clamp(16px,1.7vw,26px)] font-bold mb-3 truncate">{c.name}</p>
                  <div className="flex flex-col gap-2.5">
                    <MiniBar label="For"     color={FOR}     pct={cp(cfS, cfV)} votes={cfV} shares={cfS} showShares={cSW} />
                    <MiniBar label="Against" color={AGAINST} pct={cp(caS, caV)} votes={caV} shares={caS} showShares={cSW} />
                    <MiniBar label="Abstain" color={ABSTAIN} pct={cp(cbS, cbV)} votes={cbV} shares={cbS} showShares={cSW} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — totals + verdict */}
      <div className="px-[4vw] pb-[4vh] pt-[2vh] flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-wrap gap-x-10 gap-y-2 text-[clamp(14px,1.4vw,22px)] text-white/70 tabular-nums">
          <span>Total votes: <span className="font-bold text-white">{tV.toLocaleString()}</span></span>
          {shareWeighted && (
            <span>Total shares: <span className="font-bold text-white">{tS.toLocaleString()}</span></span>
          )}
          {typeof threshold === "number" && (
            <span>Pass mark: <span className="font-bold text-white">{threshold}%</span></span>
          )}
        </div>
        {isClosed && !isCandidate && passed !== null && passed !== undefined && (
          <div className={`flex items-center gap-3 rounded-2xl px-6 py-3 border ${passed ? "bg-green-500/15 border-green-400/50 text-green-300" : "bg-red-500/15 border-red-400/50 text-red-300"}`}>
            {passed ? <CheckCircle2 className="h-[1.2em] w-[1.2em]" /> : <XCircle className="h-[1.2em] w-[1.2em]" />}
            <span className="text-[clamp(20px,2.4vw,40px)] font-extrabold tracking-wide">{passed ? "PASSED" : "NOT PASSED"}</span>
          </div>
        )}
      </div>

      {/* Host controls — fade out when idle so they don't appear on the stream */}
      <div className={`absolute top-4 right-4 flex items-center gap-2 transition-opacity duration-300 ${idle ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {presentable.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous resolution" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronLeft className="h-5 w-5" /></button>
            <span className="text-xs text-white/70 tabular-nums px-1">{idx + 1} / {presentable.length}</span>
            <button onClick={() => go(1)} aria-label="Next resolution" className="h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
        <button onClick={onClose} aria-label="Exit full screen" className="h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 flex items-center gap-2 text-sm font-medium">
          <X className="h-4 w-4" /> Exit <span className="text-white/50 text-xs">Esc</span>
        </button>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

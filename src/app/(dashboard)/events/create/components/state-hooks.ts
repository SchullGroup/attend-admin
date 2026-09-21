"use client";
import { useState, useEffect, useRef } from "react";
import type { Format, SpeakerItem, Resolution, Prize, Criterion, AgendaRow } from "./types";

export function genId() { return Math.random().toString(36).slice(2, 10); }

// ─── Draft persistence ───────────────────────────────────────────────────────
//
// Filling in an event is a five-step form. Losing it to a reload, a stray Back,
// or a tab crash means retyping everything, which is what QA hit. Each field
// mirrors itself into localStorage and rehydrates on mount, so the form survives
// anything short of clearing site data.
//
// Not persisted, deliberately: in-flight flags (uploading / parsing) and base64
// file payloads. Flags would rehydrate as a spinner that never resolves, and a
// base64 document can be megabytes — localStorage is ~5MB in total and throws
// once it is full, which would take the whole draft down with it.

export const DRAFT_PREFIX = "attend:create-event:";

const VOLATILE = /(Base64|Uploading|Parsing|Error)$/;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

/**
 * useState that mirrors itself to localStorage.
 *
 * Hydration happens in an effect rather than in the initial state so the first
 * client render matches the server's — reading storage during render is a
 * hydration mismatch in Next.js.
 */
function useDraft<T>(moduleKey: string, field: string, initial: T) {
  const key = `${DRAFT_PREFIX}${moduleKey}.${field}`;
  const [value, setValue] = useState<T>(initial);
  const mirrorArmed = useRef(false);

  // Read once on mount. Reading eagerly here rather than inside a setState
  // updater matters: an updater runs during the NEXT render, by which point the
  // write effect below has already run — the first version of this destroyed
  // the very draft it was trying to restore.
  useEffect(() => {
    if (VOLATILE.test(field)) return;
    const stored = read<T | undefined>(key, undefined as unknown as T | undefined);
    if (stored !== undefined) setValue(stored as T);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    // Skip the run that happens on mount, before the effect above has restored
    // anything: writing there would overwrite the stored draft with the initial
    // value and there would be nothing left to restore.
    if (!mirrorArmed.current) {
      mirrorArmed.current = true;
      return;
    }
    if (VOLATILE.test(field)) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage blocked — the form keeps working in memory.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue] as const;
}

/** Wipe every saved draft. Called after a successful create, and by Discard. */
export function clearEventDrafts() {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // nothing to do — a draft that cannot be cleared is not worth failing over
  }
}

/** True when any draft value is stored, so the page can offer to discard it. */
export function hasEventDraft(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) return true;
    }
  } catch { /* storage unavailable */ }
  return false;
}

// ─── AGM ─────────────────────────────────────────────────────────────────────

export function useAgmState() {
  const [title,               setTitle]               = useDraft("agm", "title", "");
  const [description,         setDescription]         = useDraft("agm", "description", "");
  const [date,                setDate]                = useDraft("agm", "date", "");
  const [time,                setTime]                = useDraft("agm", "time", "10:00");
  const [endTime,             setEndTime]             = useDraft("agm", "endTime", "");
  const [format,              setFormat]              = useDraft<Format>("agm", "format", "hybrid");
  const [venue,               setVenue]               = useDraft("agm", "venue", "");
  const [streamUrl,           setStreamUrl]           = useDraft("agm", "streamUrl", "");
  const [capacity,            setCapacity]            = useDraft("agm", "capacity", "");
  const [rsvpEnabled,         setRsvpEnabled]         = useDraft("agm", "rsvpEnabled", true);
  const [featured,            setFeatured]            = useDraft("agm", "featured", false);
  const [flyerUrl,            setFlyerUrl]            = useDraft("agm", "flyerUrl", "");
  // AGM Notice — Cloudinary URL upload
  const [noticeFile,          setNoticeFile]          = useDraft("agm", "noticeFile", "");
  const [noticeUrl,           setNoticeUrl]           = useDraft("agm", "noticeUrl", "");
  const [noticeFileSize,      setNoticeFileSize]      = useDraft("agm", "noticeFileSize", 0);
  const [noticeUploading,     setNoticeUploading]     = useDraft("agm", "noticeUploading", false);
  const [noticeFileBase64,    setNoticeFileBase64]    = useDraft("agm", "noticeFileBase64", "");  // legacy fallback
  // Governance
  const [quorum,              setQuorum]              = useDraft("agm", "quorum", "25");
  const [cutoff,              setCutoff]              = useDraft("agm", "cutoff", "");
  const [resolutions,         setResolutions]         = useDraft<Resolution[]>("agm", "resolutions", [{ id: genId(), title: "", description: "", isSpecial: false }]);
  const [proxyEnabled,         setProxyEnabled]         = useDraft("agm", "proxyEnabled", true);
  const [shareholderTargeting, setShareholderTargeting] = useDraft<"all" | "custom">("agm", "shareholderTargeting", "all");
  // Custom shareholder list CSV — read client-side into base64 and sent as
  // agmConfig.shareholderListBase64/shareholderListFilename on submit (only
  // when shareholderTargeting === "custom"). Mirrors the AGM Notice pattern.
  const [shareholderListFilename, setShareholderListFilename] = useDraft("agm", "shareholderListFilename", "");
  const [shareholderListBase64,   setShareholderListBase64]   = useDraft("agm", "shareholderListBase64", "");
  const [shareholderListSize,     setShareholderListSize]     = useDraft("agm", "shareholderListSize", 0);
  const [shareholderListParsing,  setShareholderListParsing]  = useDraft("agm", "shareholderListParsing", false);
  const [shareholderListError,    setShareholderListError]    = useDraft("agm", "shareholderListError", "");
  // Agenda
  const [agendaItems, setAgendaItems] = useDraft<AgendaRow[]>("agm", "agendaItems", [{ id: genId(), time: "10:00", title: "", speaker: "" }]);
  const addAgendaItem    = () => setAgendaItems((a) => [...a, { id: genId(), time: "", title: "", speaker: "" }]);
  const removeAgendaItem = (id: string) => setAgendaItems((a) => a.filter((x) => x.id !== id));
  const updateAgendaItem = (id: string, field: keyof AgendaRow, val: string) =>
    setAgendaItems((a) => a.map((x) => x.id === id ? { ...x, [field]: val } : x));
  const addResolution    = () => setResolutions((r) => [...r, { id: genId(), title: "", description: "", isSpecial: false }]);
  const removeResolution = (id: string) => setResolutions((r) => r.filter((x) => x.id !== id));
  const updateResolution = (id: string, field: keyof Resolution, val: string | boolean) =>
    setResolutions((r) => r.map((x) => x.id === id ? { ...x, [field]: val } : x));
  return {
    title, setTitle, description, setDescription,
    date, setDate, time, setTime, endTime, setEndTime,
    format, setFormat, venue, setVenue, streamUrl, setStreamUrl,
    capacity, setCapacity, rsvpEnabled, setRsvpEnabled, featured, setFeatured,
    flyerUrl, setFlyerUrl,
    noticeFile, setNoticeFile, noticeUrl, setNoticeUrl,
    noticeFileSize, setNoticeFileSize, noticeUploading, setNoticeUploading,
    noticeFileBase64, setNoticeFileBase64,
    quorum, setQuorum, cutoff, setCutoff,
    resolutions, addResolution, removeResolution, updateResolution,
    proxyEnabled, setProxyEnabled,
    shareholderTargeting, setShareholderTargeting,
    shareholderListFilename, setShareholderListFilename,
    shareholderListBase64,   setShareholderListBase64,
    shareholderListSize,     setShareholderListSize,
    shareholderListParsing,  setShareholderListParsing,
    shareholderListError,    setShareholderListError,
    agendaItems, addAgendaItem, removeAgendaItem, updateAgendaItem,
  };
}

// ─── Launch ───────────────────────────────────────────────────────────────────

export function useLaunchState() {
  const [title,          setTitle]          = useDraft("launch", "title", "");
  const [description,    setDescription]    = useDraft("launch", "description", "");
  const [date,           setDate]           = useDraft("launch", "date", "");
  const [time,           setTime]           = useDraft("launch", "time", "10:00");
  const [endTime,        setEndTime]        = useDraft("launch", "endTime", "");
  const [format,         setFormat]         = useDraft<Format>("launch", "format", "virtual");
  const [venue,          setVenue]          = useDraft("launch", "venue", "");
  const [streamUrl,      setStreamUrl]      = useDraft("launch", "streamUrl", "");
  const [capacity,       setCapacity]       = useDraft("launch", "capacity", "");
  const [productName,    setProductName]    = useDraft("launch", "productName", "");
  const [tagline,        setTagline]        = useDraft("launch", "tagline", "");
  const [productDesc,    setProductDesc]    = useDraft("launch", "productDesc", "");
  const [slug,           setSlug]           = useDraft("launch", "slug", "");
  const [flyerUrl,       setFlyerUrl]       = useDraft("launch", "flyerUrl", "");
  const [speakers,       setSpeakers]       = useDraft<SpeakerItem[]>("launch", "speakers", [{ id: genId(), name: "", role: "", bio: "" }]);
  const [embargoEnabled, setEmbargoEnabled] = useDraft("launch", "embargoEnabled", false);
  const [embargoAt,      setEmbargoAt]      = useDraft("launch", "embargoAt", "");
  const [audienceMode,   setAudienceMode]   = useDraft<"open" | "invite">("launch", "audienceMode", "open");
  const [featured,            setFeatured]            = useDraft("launch", "featured", false);
  const addSpeaker    = () => setSpeakers((s) => [...s, { id: genId(), name: "", role: "", bio: "" }]);
  const removeSpeaker = (id: string) => setSpeakers((s) => s.filter((x) => x.id !== id));
  const updateSpeaker = (id: string, field: keyof SpeakerItem, val: string) =>
    setSpeakers((s) => s.map((x) => x.id === id ? { ...x, [field]: val } : x));
  return {
    title, setTitle, description, setDescription,
    date, setDate, time, setTime, endTime, setEndTime,
    format, setFormat, venue, setVenue, streamUrl, setStreamUrl,
    capacity, setCapacity,
    productName, setProductName, tagline, setTagline, productDesc, setProductDesc, slug, setSlug,
    flyerUrl, setFlyerUrl,
    speakers, addSpeaker, removeSpeaker, updateSpeaker,
    embargoEnabled, setEmbargoEnabled, embargoAt, setEmbargoAt,
    audienceMode, setAudienceMode, featured, setFeatured,
  };
}

/**
 * Share 100% evenly across judging criteria — what the "Split evenly" button
 * does. Not applied automatically on add or remove: rewriting figures the user
 * typed is worse than showing them a total that needs adjusting.
 *
 * Whole numbers only: the remainder goes to the first rows, so three criteria
 * are 34/33/33 rather than three recurring decimals that never quite total 100.
 */
function splitEvenly(list: Criterion[]): Criterion[] {
  if (list.length === 0) return list;
  const base      = Math.floor(100 / list.length);
  const remainder = 100 - base * list.length;
  return list.map((c, i) => ({ ...c, weight: `${base + (i < remainder ? 1 : 0)}%` }));
}

// ─── Hackathon ────────────────────────────────────────────────────────────────

export function useHackState() {
  const [title,              setTitle]              = useDraft("hack", "title", "");
  const [description,        setDescription]        = useDraft("hack", "description", "");
  const [theme,              setTheme]              = useDraft("hack", "theme", "");
  const [startDate,          setStartDate]          = useDraft("hack", "startDate", "");
  const [endDate,            setEndDate]            = useDraft("hack", "endDate", "");
  const [time,               setTime]               = useDraft("hack", "time", "09:00");
  const [endTime,            setEndTime]            = useDraft("hack", "endTime", "");
  const [format,             setFormat]             = useDraft<Format>("hack", "format", "virtual");
  const [venue,              setVenue]              = useDraft("hack", "venue", "");
  const [streamUrl,          setStreamUrl]          = useDraft("hack", "streamUrl", "");
  const [problemStatement,   setProblemStatement]   = useDraft("hack", "problemStatement", "");
  const [deliverable,        setDeliverable]        = useDraft("hack", "deliverable", "");
  const [submissionDeadline, setSubmissionDeadline] = useDraft("hack", "submissionDeadline", "");
  const [techStack,          setTechStack]          = useDraft("hack", "techStack", "");
  const [participationType,  setParticipationType]  = useDraft<"solo" | "team" | "both">("hack", "participationType", "both");
  const [minTeam,            setMinTeam]            = useDraft("hack", "minTeam", "2");
  const [maxTeam,            setMaxTeam]            = useDraft("hack", "maxTeam", "5");
  const [eligibility,        setEligibility]        = useDraft("hack", "eligibility", "");
  const [capacity,           setCapacity]           = useDraft("hack", "capacity", "");
  const [featured,            setFeatured]            = useDraft("hack", "featured", false);
  // Optional challenge flyer — same plain-URL field product launches use, accepted on the
  // challenge config as of the backend's 2026-09-14 note.
  const [flyerUrl,           setFlyerUrl]           = useDraft("hack", "flyerUrl", "");
  const [prizes,  setPrizes]  = useDraft<Prize[]>("hack", "prizes", [
    { id: genId(), place: "1st Place", reward: "" },
    { id: genId(), place: "2nd Place", reward: "" },
    { id: genId(), place: "3rd Place", reward: "" },
  ]);
  const [criteria, setCriteria] = useDraft<Criterion[]>("hack", "criteria", [
    { id: genId(), label: "Innovation", weight: "30%" },
    { id: genId(), label: "Impact",     weight: "30%" },
    { id: genId(), label: "Execution",  weight: "40%" },
  ]);
  const addPrize       = () => setPrizes((p) => [...p, { id: genId(), place: "", reward: "" }]);
  const removePrize    = (id: string) => setPrizes((p) => p.filter((x) => x.id !== id));
  const updatePrize    = (id: string, field: "place" | "reward", val: string) =>
    setPrizes((p) => p.map((x) => x.id === id ? { ...x, [field]: val } : x));
  // A new criterion arrives at a round 20% rather than silently re-weighting the
  // rows the user already set. The total then reads over or under 100% and they
  // adjust — which is the trade-off they are making anyway, made visible.
  const addCriterion    = () => setCriteria((c) => [...c, { id: genId(), label: "", weight: "20%" }]);
  const removeCriterion = (id: string) => setCriteria((c) => c.filter((x) => x.id !== id));
  const splitCriteriaEvenly = () => setCriteria((c) => splitEvenly(c));
  const updateCriterion = (id: string, field: "label" | "weight", val: string) =>
    setCriteria((c) => c.map((x) => x.id === id ? { ...x, [field]: val } : x));
  return {
    title, setTitle, description, setDescription,
    theme, setTheme, startDate, setStartDate, endDate, setEndDate,
    time, setTime, endTime, setEndTime,
    format, setFormat, venue, setVenue, streamUrl, setStreamUrl,
    problemStatement, setProblemStatement,
    deliverable, setDeliverable, submissionDeadline, setSubmissionDeadline,
    techStack, setTechStack, participationType, setParticipationType,
    minTeam, setMinTeam, maxTeam, setMaxTeam,
    eligibility, setEligibility, capacity, setCapacity, featured, setFeatured,
    flyerUrl, setFlyerUrl,
    prizes, addPrize, removePrize, updatePrize,
    criteria, addCriterion, removeCriterion, updateCriterion, splitCriteriaEvenly,
  };
}

// ─── General ─────────────────────────────────────────────────────────────────

export function useGeneralState() {
  const [title,               setTitle]               = useDraft("general", "title", "");
  const [description,         setDescription]         = useDraft("general", "description", "");
  const [date,                setDate]                = useDraft("general", "date", "");
  const [time,                setTime]                = useDraft("general", "time", "10:00");
  const [endTime,             setEndTime]             = useDraft("general", "endTime", "");
  const [format,              setFormat]              = useDraft<Format>("general", "format", "virtual");
  const [venue,               setVenue]               = useDraft("general", "venue", "");
  const [streamUrl,           setStreamUrl]           = useDraft("general", "streamUrl", "");
  const [capacity,            setCapacity]            = useDraft("general", "capacity", "");
  const [audienceMode,        setAudienceMode]        = useDraft<"open" | "invite">("general", "audienceMode", "open");
  const [featured,            setFeatured]            = useDraft("general", "featured", false);
  const [flyerUrl,            setFlyerUrl]            = useDraft("general", "flyerUrl", "");
  return {
    title, setTitle, description, setDescription,
    date, setDate, time, setTime, endTime, setEndTime,
    format, setFormat, venue, setVenue, streamUrl, setStreamUrl,
    capacity, setCapacity, audienceMode, setAudienceMode, featured, setFeatured,
    flyerUrl, setFlyerUrl,
  };
}

export type AgmState     = ReturnType<typeof useAgmState>;
export type LaunchState  = ReturnType<typeof useLaunchState>;
export type HackState    = ReturnType<typeof useHackState>;
export type GeneralState = ReturnType<typeof useGeneralState>;

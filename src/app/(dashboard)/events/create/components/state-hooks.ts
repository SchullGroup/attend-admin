"use client";
import { useState } from "react";
import type { Format, SpeakerItem, Resolution, Prize, Criterion, AgendaRow } from "./types";

export function genId() { return Math.random().toString(36).slice(2, 10); }

// ─── AGM ─────────────────────────────────────────────────────────────────────

export function useAgmState() {
  const [title,               setTitle]               = useState("");
  const [description,         setDescription]         = useState("");
  const [date,                setDate]                = useState("");
  const [time,                setTime]                = useState("10:00");
  const [endTime,             setEndTime]             = useState("");
  const [format,              setFormat]              = useState<Format>("hybrid");
  const [venue,               setVenue]               = useState("");
  const [streamUrl,           setStreamUrl]           = useState("");
  const [capacity,            setCapacity]            = useState("");
  const [rsvpEnabled,         setRsvpEnabled]         = useState(true);
  const [featured,            setFeatured]            = useState(false);
  // AGM Notice — Cloudinary URL upload
  const [noticeFile,          setNoticeFile]          = useState("");
  const [noticeUrl,           setNoticeUrl]           = useState("");
  const [noticeFileSize,      setNoticeFileSize]      = useState(0);
  const [noticeUploading,     setNoticeUploading]     = useState(false);
  const [noticeFileBase64,    setNoticeFileBase64]    = useState("");  // legacy fallback
  // Governance
  const [quorum,              setQuorum]              = useState("25");
  const [cutoff,              setCutoff]              = useState("");
  const [resolutions,         setResolutions]         = useState<Resolution[]>([{ id: genId(), title: "", description: "", isSpecial: false }]);
  const [proxyEnabled,        setProxyEnabled]        = useState(true);
  const [shareholderTargeting, setShareholderTargeting] = useState<"all" | "custom">("all");
  // Agenda
  const [agendaItems, setAgendaItems] = useState<AgendaRow[]>([{ id: genId(), time: "10:00", title: "", speaker: "" }]);
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
    noticeFile, setNoticeFile, noticeUrl, setNoticeUrl,
    noticeFileSize, setNoticeFileSize, noticeUploading, setNoticeUploading,
    noticeFileBase64, setNoticeFileBase64,
    quorum, setQuorum, cutoff, setCutoff,
    resolutions, addResolution, removeResolution, updateResolution,
    proxyEnabled, setProxyEnabled,
    shareholderTargeting, setShareholderTargeting,
    agendaItems, addAgendaItem, removeAgendaItem, updateAgendaItem,
  };
}

// ─── Launch ───────────────────────────────────────────────────────────────────

export function useLaunchState() {
  const [title,          setTitle]          = useState("");
  const [description,    setDescription]    = useState("");
  const [date,           setDate]           = useState("");
  const [time,           setTime]           = useState("10:00");
  const [endTime,        setEndTime]        = useState("");
  const [format,         setFormat]         = useState<Format>("virtual");
  const [venue,          setVenue]          = useState("");
  const [streamUrl,      setStreamUrl]      = useState("");
  const [capacity,       setCapacity]       = useState("");
  const [productName,    setProductName]    = useState("");
  const [tagline,        setTagline]        = useState("");
  const [productDesc,    setProductDesc]    = useState("");
  const [slug,           setSlug]           = useState("");
  const [speakers,       setSpeakers]       = useState<SpeakerItem[]>([{ id: genId(), name: "", role: "", bio: "" }]);
  const [embargoEnabled, setEmbargoEnabled] = useState(false);
  const [embargoAt,      setEmbargoAt]      = useState("");
  const [audienceMode,   setAudienceMode]   = useState<"open" | "invite">("open");
  const [featured,       setFeatured]       = useState(false);
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
    speakers, addSpeaker, removeSpeaker, updateSpeaker,
    embargoEnabled, setEmbargoEnabled, embargoAt, setEmbargoAt,
    audienceMode, setAudienceMode, featured, setFeatured,
  };
}

// ─── Hackathon ────────────────────────────────────────────────────────────────

export function useHackState() {
  const [title,              setTitle]              = useState("");
  const [description,        setDescription]        = useState("");
  const [theme,              setTheme]              = useState("");
  const [startDate,          setStartDate]          = useState("");
  const [endDate,            setEndDate]            = useState("");
  const [time,               setTime]               = useState("09:00");
  const [endTime,            setEndTime]            = useState("");
  const [format,             setFormat]             = useState<Format>("virtual");
  const [venue,              setVenue]              = useState("");
  const [streamUrl,          setStreamUrl]          = useState("");
  const [problemStatement,   setProblemStatement]   = useState("");
  const [deliverable,        setDeliverable]        = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [techStack,          setTechStack]          = useState("");
  const [participationType,  setParticipationType]  = useState<"solo" | "team" | "both">("both");
  const [minTeam,            setMinTeam]            = useState("2");
  const [maxTeam,            setMaxTeam]            = useState("5");
  const [eligibility,        setEligibility]        = useState("");
  const [capacity,           setCapacity]           = useState("");
  const [featured,           setFeatured]           = useState(false);
  const [prizes,  setPrizes]  = useState<Prize[]>([
    { id: genId(), place: "1st Place", reward: "" },
    { id: genId(), place: "2nd Place", reward: "" },
    { id: genId(), place: "3rd Place", reward: "" },
  ]);
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: genId(), label: "Innovation", weight: "30%" },
    { id: genId(), label: "Impact",     weight: "30%" },
    { id: genId(), label: "Execution",  weight: "40%" },
  ]);
  const addPrize       = () => setPrizes((p) => [...p, { id: genId(), place: "", reward: "" }]);
  const removePrize    = (id: string) => setPrizes((p) => p.filter((x) => x.id !== id));
  const updatePrize    = (id: string, field: "place" | "reward", val: string) =>
    setPrizes((p) => p.map((x) => x.id === id ? { ...x, [field]: val } : x));
  const addCriterion    = () => setCriteria((c) => [...c, { id: genId(), label: "", weight: "" }]);
  const removeCriterion = (id: string) => setCriteria((c) => c.filter((x) => x.id !== id));
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
    prizes, addPrize, removePrize, updatePrize,
    criteria, addCriterion, removeCriterion, updateCriterion,
  };
}

// ─── General ─────────────────────────────────────────────────────────────────

export function useGeneralState() {
  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [date,         setDate]         = useState("");
  const [time,         setTime]         = useState("10:00");
  const [endTime,      setEndTime]      = useState("");
  const [format,       setFormat]       = useState<Format>("virtual");
  const [venue,        setVenue]        = useState("");
  const [streamUrl,    setStreamUrl]    = useState("");
  const [capacity,     setCapacity]     = useState("");
  const [audienceMode, setAudienceMode] = useState<"open" | "invite">("open");
  const [featured,     setFeatured]     = useState(false);
  return {
    title, setTitle, description, setDescription,
    date, setDate, time, setTime, endTime, setEndTime,
    format, setFormat, venue, setVenue, streamUrl, setStreamUrl,
    capacity, setCapacity, audienceMode, setAudienceMode, featured, setFeatured,
  };
}

export type AgmState     = ReturnType<typeof useAgmState>;
export type LaunchState  = ReturnType<typeof useLaunchState>;
export type HackState    = ReturnType<typeof useHackState>;
export type GeneralState = ReturnType<typeof useGeneralState>;

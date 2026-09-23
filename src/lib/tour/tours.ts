import type { Tour } from "./types";

/**
 * Tour content.
 *
 * Written for someone on their first morning, not for someone who already
 * knows the product. Two rules held throughout:
 *
 * - Say what a screen is *for*, not what it is called. The label is already on
 *   screen next to the card; repeating it teaches nothing.
 * - Name the thing that would otherwise be learned the hard way — that
 *   submission fields are painful to change once teams start applying, that
 *   ending a challenge locks statuses, that a register must exist before an
 *   event can have an organiser.
 *
 * Steps deliberately never navigate to Create Event or any other form: a tour
 * that dumps a half-filled draft into someone's restored-draft banner is worse
 * than no tour. Those are pointed at in the sidebar instead.
 */

export const WELCOME_TOUR_ID = "welcome";

const CLIENT_ROLES = ["client_admin", "admin", "event_manager", "viewer", "kyc_officer"] as const;

// Judges see a different product: Dashboard, Challenges, Applications, Judging,
// Notifications, Settings. No Events, Registers, Documents, Analytics, and no
// global search in the header. Steps about any of that are restricted to
// everyone else — a tour that navigates someone to a route missing from their
// own sidebar is worse than one that skips it.
const NON_JUDGE_ROLES = ["super_admin", ...CLIENT_ROLES] as const;

export const TOURS: Tour[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Welcome — the first-run pass. Short on purpose.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: WELCOME_TOUR_ID,
    label: "Getting started",
    description: "A two-minute lap of the platform.",
    steps: [
      {
        id: "welcome-hello",
        title: "Welcome to Attend",
        body: "This is where you run events for the companies on your register — AGMs, product launches and innovation challenges. Two minutes here and you will know where everything lives. You can leave at any point and pick it up again from your profile menu.",
      },
      {
        id: "welcome-sidebar",
        title: "Everything starts here",
        body: "The sidebar is grouped by what you are doing rather than by screen. You only see the groups your role can reach, so it is shorter for some people than others — nothing is missing.",
        target: "sidebar",
        placement: "right",
        padding: 4,
      },
      {
        id: "welcome-dashboard",
        title: "Your dashboard",
        body: "What is live now, what is coming, and what needs a decision from you. If you only open one screen a day, this is the one.",
        route: "/",
        target: "nav:/",
        placement: "right",
      },
      {
        id: "welcome-events",
        title: "Events",
        body: "Every event across every company you act for. An event is the container — the agenda, the attendees, the documents and the voting all hang off it.",
        route: "/events",
        target: "nav:/events",
        placement: "right",
        roles: [...NON_JUDGE_ROLES],
      },
      {
        id: "welcome-events-tabs",
        title: "Four kinds of event",
        body: "AGM, Launch, Innovation and General. They share a shell but each unlocks its own tools — resolutions and proxies for an AGM, tiers and invitations for a launch, judging for a challenge.",
        route: "/events",
        target: "events-type-tabs",
        placement: "bottom",
        roles: [...CLIENT_ROLES],
      },
      {
        id: "welcome-create",
        title: "Creating one",
        body: "The create flow asks for the event type first, because that decides what it asks you next. Pick the register that is hosting it, and it inherits that company's branding automatically.",
        target: "nav:/events/create",
        placement: "right",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "welcome-live",
        title: "On the day",
        body: "The Live Control Room is the one you sit in while an event is running — attendance, questions, polls and resolutions, all on one screen so you are not switching tabs in front of an audience.",
        target: "nav:/events/live",
        placement: "right",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "welcome-challenges",
        title: "Innovation Challenges",
        body: "Hackathons and innovation programmes: teams apply, judges score, winners get announced and certificated. It has more moving parts than the rest, so there is a tour of its own — take it when you are about to run one.",
        route: "/hackathons",
        target: "nav:/hackathons",
        placement: "right",
      },
      {
        id: "welcome-applications-judge",
        title: "Applications",
        body: "The submissions from teams on the challenges you are judging — pick a challenge and read what each team sent in. This is the material you score against.",
        route: "/hackathons/applications",
        target: "nav:/hackathons/applications",
        placement: "right",
        roles: ["judge"],
      },
      {
        id: "welcome-judging-judge",
        title: "Judging",
        body: "Where you actually score. Open a challenge, work through its shortlisted teams, and watch the leaderboard settle as you and the other judges submit.",
        route: "/hackathons/judging",
        target: "nav:/hackathons/judging",
        placement: "right",
        roles: ["judge"],
      },
      {
        id: "welcome-notifications-judge",
        title: "Notifications",
        body: "You are told here when you are assigned to a challenge and when scoring opens on one — the two moments something needs you.",
        target: "nav:/notifications",
        placement: "right",
        roles: ["judge"],
      },
      {
        id: "welcome-registers",
        title: "Registers",
        body: "A register is a company you act for, and its shareholders. Events belong to a register, so this is usually the first thing set up for a new client.",
        target: "nav:/registers",
        placement: "right",
        roles: [...CLIENT_ROLES],
      },
      {
        id: "welcome-registrars",
        title: "Registrars",
        body: "Every registrar firm on the platform and the registers underneath each one. This is the level above what a client admin sees.",
        target: "nav:/registrars",
        placement: "right",
        roles: ["super_admin"],
      },
      {
        id: "welcome-search",
        title: "When you know what you want",
        body: "Search across events, participants and organisations without working out which screen holds them. Quicker than navigating once you know a name.",
        target: "global-search",
        placement: "bottom",
        roles: [...NON_JUDGE_ROLES],
      },
      {
        id: "welcome-documents",
        title: "Documents and analytics",
        body: "Every notice, agenda and report you have published, in one vault — and the numbers underneath: turnout, fill rates, verification. Both filter by register and by event.",
        target: "nav:/documents",
        placement: "right",
        roles: [...NON_JUDGE_ROLES],
      },
      {
        id: "welcome-replay",
        title: "That is the lap",
        body: "Deeper tours live in your profile menu — one each for events, challenges, registers and judging. Take them when you are about to do that thing for real; they make more sense with a live example in front of you.",
        target: "profile-menu",
        placement: "bottom",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Innovation Challenges — the deep one.
  //
  // Steps from "ch-just-made-one" onward stand on a real challenge, because
  // the screen QA flagged as overwhelming is the one you land on straight
  // after creating: nine tabs, four zeroes and no obvious first move. Reading
  // about it from a centred card does not fix that; being shown which of the
  // nine tabs to touch first does.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "challenges",
    label: "Innovation Challenges",
    description: "From brief to announcing winners.",
    roles: [...CLIENT_ROLES],
    requires: ["challengeId"],
    steps: [
      {
        id: "ch-intro",
        title: "How a challenge runs",
        body: "Seven stages, in order: write the brief, decide what teams submit, open applications, shortlist, assign judges, score, announce. Each stage has a tab, and they run left to right in the order you use them.",
        route: "/hackathons",
      },
      {
        id: "ch-list",
        title: "Your challenges",
        body: "Draft, Published, Live and Ended. A challenge stays Draft until you publish it, so nothing is visible to teams while you are still writing it.",
        route: "/hackathons",
        target: "challenges-list",
        placement: "top",
      },
      {
        id: "ch-guide",
        title: "The short version",
        body: "The same sequence in writing. It stays on this page after the tour ends — dismiss it once you know the flow and it collapses to a button you can reopen.",
        route: "/hackathons",
        target: "challenge-guide",
        placement: "bottom",
        // The panel is only rendered for client roles; without this the step
        // spotlit an empty strip and described something that was not there.
        roles: [...CLIENT_ROLES],
      },

      // ── Landing on a real one ───────────────────────────────────────────
      {
        id: "ch-just-made-one",
        title: "You have just created one. Now what?",
        body: "This is the screen straight after creating a challenge, and it is a lot at once: nine tabs and four zeroes. You do not need most of it yet. The next few steps are the three things that actually matter on day one, in order.",
        route: "/hackathons/:challengeId?tab=Overview",
      },
      {
        id: "ch-tabs",
        title: "Nine tabs, used in order",
        body: "They are laid out in the order the work happens, and most stay empty until earlier stages fill them. Winners has nothing in it until judging is done. Ignore everything to the right of where you are.",
        route: "/hackathons/:challengeId?tab=Overview",
        target: "challenge-tabs",
        placement: "bottom",
      },
      {
        id: "ch-hint",
        title: "The app tells you the next move",
        body: "This line changes with the state of the challenge and always names the single next action. When you are unsure what to do, it is the answer — on every tab, not just this one.",
        route: "/hackathons/:challengeId?tab=Overview",
        target: "challenge-next-hint",
        placement: "bottom",
      },
      {
        id: "ch-zeroes",
        title: "Zeroes are normal here",
        body: "No applications, no shortlist, no judges — correct for a challenge nobody can see yet. They fill in as you work through the stages; nothing here is broken.",
        route: "/hackathons/:challengeId?tab=Overview",
        target: "challenge-stats",
        placement: "bottom",
      },

      // ── Stage 1: the form ───────────────────────────────────────────────
      {
        id: "ch-settings",
        title: "First: decide what teams submit",
        body: "Settings defines the application form — the questions, the fields, the uploads. Do this before you open applications. Change it afterwards and early teams will have answered different questions from later ones, which you cannot fairly compare.",
        route: "/hackathons/:challengeId?tab=Overview",
        target: "challenge-tab:Settings",
        placement: "bottom",
        roles: ["client_admin", "admin", "event_manager"],
      },

      // ── Stage 2: open ───────────────────────────────────────────────────
      {
        id: "ch-open",
        title: "Second: open applications",
        body: "This is what makes the challenge visible to teams. The app will ask you to check your form first — that prompt exists because the form is the one thing that is genuinely painful to change later.",
        route: "/hackathons/:challengeId?tab=Overview",
        target: "challenge-open-toggle",
        placement: "left",
        roles: ["client_admin", "admin", "event_manager"],
      },

      // ── Stage 3 onward ──────────────────────────────────────────────────
      {
        id: "ch-applications",
        title: "Third: read what came in",
        body: "Every team with its idea, track and members. The status pills across the top are the pipeline: Submitted, Under Review, Shortlisted, Selected, Not Progressed. Move teams along as you read them.",
        route: "/hackathons/:challengeId?tab=Applications",
        target: "challenge-tab:Applications",
        placement: "bottom",
      },
      {
        id: "ch-shortlist",
        title: "Shortlisted is the gate",
        body: "Only shortlisted teams reach the judges. That is the line between everyone who applied and the group that actually gets scored, so it is worth being deliberate about.",
        route: "/hackathons/:challengeId?tab=Applications",
      },
      {
        id: "ch-tracks",
        title: "Tracks",
        body: "If your challenge has themes — Payments, Lending, whatever you set — teams pick one when they apply, and you can filter and judge by track. Useful when you want a winner per theme rather than one overall.",
        route: "/hackathons/:challengeId?tab=Applications",
      },
      {
        id: "ch-judges",
        title: "Judges and scoring",
        body: "Add judges from your own team here, then turn Scoring on. Until you do, judges can see their assignments but cannot enter marks — which is what you want while you are still shortlisting.",
        route: "/hackathons/:challengeId?tab=Judges",
        target: "challenge-tab:Judges",
        placement: "bottom",
      },
      {
        id: "ch-criteria",
        title: "Criteria and weights",
        body: "Scoring criteria are set when the challenge is created and must total 100%. Each new one starts at 20%, so you adjust the others to balance it — that trade-off is deliberate, it makes you decide what actually matters.",
        route: "/hackathons/:challengeId?tab=Judges",
      },
      {
        id: "ch-leaderboard",
        title: "The leaderboard",
        body: "Ranks shortlisted teams by weighted score as judges submit. It updates on its own — no recalculation step, nothing to publish before you can read it.",
        route: "/hackathons/:challengeId?tab=Leaderboard",
        target: "challenge-tab:Leaderboard",
        placement: "bottom",
      },
      {
        id: "ch-end",
        title: "Ending it",
        body: "Ending the challenge locks application statuses for good. Do it once judging is genuinely finished: after that you cannot move a team between statuses, by design, so the record of what was decided stays fixed.",
        route: "/hackathons/:challengeId?tab=Overview",
        target: "challenge-end",
        placement: "top",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "ch-winners",
        title: "Winners and certificates",
        body: "Announce winners here once the challenge has ended, then generate certificates. Certificates use a template you design once — position the name and date on your artwork and it applies to every team.",
        route: "/hackathons/:challengeId?tab=Winners",
        target: "challenge-tab:Winners",
        placement: "bottom",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Events & the AGM lifecycle.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "events",
    label: "Events & AGMs",
    description: "Creating an event, the live room, and inside a vote record.",
    roles: [...CLIENT_ROLES],
    steps: [
      {
        id: "ev-intro",
        title: "The shape of an event",
        body: "Create it, invite people, run it on the day, then publish what happened. An AGM adds a formal layer on top of that — resolutions, proxies and a recorded vote — because the outcome is a legal record rather than a nice-to-have.",
        route: "/events",
      },
      {
        id: "ev-list",
        title: "Every event, filtered",
        body: "Tabs narrow by type, the dropdown by organiser, and search by title. Whatever you pick stays in the address bar, so a reload — or a link you paste to a colleague — reopens the same view.",
        route: "/events",
        target: "events-filters",
        placement: "bottom",
      },
      {
        id: "ev-create",
        title: "Creating one",
        body: "Pick the event type first: it decides every question after it. You need a register selected, since the register is the company hosting the event and supplies its branding.",
        target: "nav:/events/create",
        placement: "right",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "ev-draft",
        title: "Your work is kept",
        body: "The create form saves as you type. Reload, navigate away, come back tomorrow — it offers to restore what you had. Nothing is submitted until you finish, so a draft costs nothing.",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "ev-detail",
        title: "Inside an event",
        body: "Overview holds the agenda and the status. Attendees, Documents and Broadcast handle the people, the paperwork and the emails. An AGM adds Resolutions; a launch adds Invitations and Media.",
        placement: "bottom",
      },
      {
        id: "ev-documents",
        title: "Notices and agendas",
        body: "Upload the notice, the agenda and the annual report against the event. Shareholders see them in the attendee app, and every download is counted — useful when someone asks whether a notice actually reached people.",
        placement: "bottom",
      },
      {
        id: "ev-resolutions",
        title: "Resolutions",
        body: "Each resolution is voted on separately and carries its own result. Set them up before the meeting; you open them one at a time on the day so the room votes together rather than at their own pace.",
        placement: "bottom",
      },
      {
        id: "ev-proxies",
        title: "Proxies",
        body: "Shareholders who cannot attend appoint someone to vote for them. Proxies are logged against the event with their units, and you can upload in-person proxy votes in bulk rather than keying them one by one.",
        placement: "bottom",
      },
      {
        id: "ev-live",
        title: "The live room",
        body: "Attendance, questions, polls and resolutions on one screen, with the Zoom session embedded. This is the screen you sit in for the whole meeting — it is built so you never have to leave it while people are watching.",
        target: "nav:/events/live",
        placement: "right",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "ev-qr",
        title: "Checking people in",
        body: "For a physical or hybrid event, scan attendees in from a phone at the door. It runs on the same login — open it on the device you are holding.",
        target: "nav:/events/qr-checkin",
        placement: "right",
        roles: ["client_admin", "admin", "event_manager", "kyc_officer"],
      },
      {
        id: "ev-votes",
        title: "After the meeting",
        body: "Vote Records keeps the outcome of every resolution and lets you enter offline votes that came in on paper. This is the record you export when someone asks what was passed.",
        route: "/votes",
        target: "nav:/votes",
        placement: "right",
        roles: ["client_admin", "admin", "event_manager", "viewer"],
      },

      // ── Inside one vote record ──────────────────────────────────────────
      // The second screen QA called overwhelming. Same treatment as the
      // challenge detail: stand on a real one and name the three things that
      // decide whether a resolution passes.
      {
        id: "vt-open",
        title: "Inside one AGM",
        body: "Three numbers, a list of resolutions and a proxy register. That is the whole screen — and between them they decide whether each resolution passes.",
        route: "/votes/:voteEventId",
        roles: ["client_admin", "admin", "event_manager", "viewer"],
      },
      {
        id: "vt-summary",
        title: "Votes cast, quorum, register",
        body: "Votes cast counts what has come in. The register names the company. Quorum is the one to watch — it is the share of the register that must take part before a vote counts at all.",
        route: "/votes/:voteEventId",
        target: "vote-summary",
        placement: "bottom",
        roles: ["client_admin", "admin", "event_manager", "viewer"],
      },
      {
        id: "vt-quorum",
        title: "Quorum decides whether anything counts",
        body: "Set the required percentage with the pencil. It locks the moment voting opens on any resolution — nobody can move the bar once the room has started voting, which is the point.",
        route: "/votes/:voteEventId",
        target: "vote-quorum",
        placement: "bottom",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "vt-resolutions",
        title: "Resolutions, one at a time",
        body: "Each one is voted on separately and carries its own result. Waiting means it has not been opened yet. You open them one at a time on the day so the room votes together rather than at their own pace.",
        route: "/votes/:voteEventId",
        target: "vote-resolutions",
        placement: "top",
        roles: ["client_admin", "admin", "event_manager", "viewer"],
      },
      {
        id: "vt-failed",
        title: "\"Failed\" before anyone has voted is normal",
        body: "A resolution with no votes shows 0% for, so it reads as failed. That is arithmetic on an empty set, not a result — it settles once voting opens and people take part.",
        route: "/votes/:voteEventId",
        roles: ["client_admin", "admin", "event_manager", "viewer"],
      },
      {
        id: "vt-proxies",
        title: "The proxy register",
        body: "Shareholders who cannot attend appoint someone to vote for them, with their units. Bulk Upload takes the paper proxies in one file rather than keying them one by one.",
        route: "/votes/:voteEventId",
        target: "vote-proxies",
        placement: "top",
        roles: ["client_admin", "admin", "event_manager", "viewer"],
      },
      {
        id: "vt-export",
        title: "The record you hand over",
        body: "Export CSV gives you every resolution and its outcome. This is what goes to the company when they ask what was passed at their AGM.",
        route: "/votes/:voteEventId",
        target: "vote-export",
        placement: "bottom",
        roles: ["client_admin", "admin", "event_manager", "viewer"],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Registers & shareholders.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "registers",
    label: "Registers & shareholders",
    description: "Enrolling a company and loading its shareholders.",
    roles: [...CLIENT_ROLES],
    steps: [
      {
        id: "rg-intro",
        title: "What a register is",
        body: "A register is one company you act for, plus the shareholders on its books. Nothing else works without it — an event needs a register to be its organiser, and a shareholder needs one to belong to.",
        route: "/registers",
      },
      {
        id: "rg-list",
        title: "The directory",
        body: "Every register you hold, by status. Pending ones are waiting on approval; suspended ones stay visible but cannot host new events.",
        route: "/registers",
        target: "registers-list",
        placement: "top",
      },
      {
        id: "rg-enrol",
        title: "Adding a company",
        body: "Enrol Register takes the company details and its representative. Once approved it can host events and receive shareholders.",
        target: "nav:/registers/enrol",
        placement: "right",
        roles: ["super_admin", "client_admin", "admin"],
      },
      {
        id: "rg-shareholders",
        title: "Loading shareholders",
        body: "Add them one at a time, or upload a CSV for the whole book. The upload reports back which rows failed and why, rather than silently dropping them — worth reading before you assume it all landed.",
        placement: "bottom",
      },
      {
        id: "rg-chn",
        title: "CHN and units",
        body: "The CHN identifies a shareholder in the clearing system and the units decide their voting weight. Both matter at vote time: units are what a resolution result is calculated from.",
        placement: "bottom",
      },
      {
        id: "rg-documents",
        title: "Company documents",
        body: "Documents can attach to a register rather than a single event — the things that stay true between meetings.",
        route: "/documents",
        target: "nav:/documents",
        placement: "right",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. Certificates.
  //
  // Short on purpose: the whole thing hinges on one idea people get wrong,
  // which is that the design and the issuing are separate steps, and that a
  // design can belong either to this event or to the whole organisation.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "certificates",
    label: "Certificates",
    description: "Designing the artwork and issuing it to teams.",
    roles: ["client_admin", "admin", "event_manager", "viewer"],
    requires: ["challengeId"],
    steps: [
      {
        id: "cert-intro",
        title: "Two separate jobs",
        body: "Designing the certificate and handing it out are different things. You set the artwork up once and it sits there; issuing is a separate action you take when the challenge is over. Nothing is sent to anyone while you are still designing.",
        route: "/hackathons/:challengeId?tab=Certificates",
      },
      {
        id: "cert-scope",
        title: "This event, or every event",
        body: "The design belongs either to this one challenge or to your whole organisation. \"Organisation default\" is the one to set first — it applies to every event that has not been given its own, so you design once instead of per challenge.",
        route: "/hackathons/:challengeId?tab=Certificates",
        target: "cert-scope",
        placement: "bottom",
      },
      {
        id: "cert-override",
        title: "How the two interact",
        body: "A design saved on \"This event\" wins for this event only, and leaves the organisation default untouched everywhere else. Use it when one challenge needs its own look — a sponsor's branding, say — without disturbing the rest.",
        route: "/hackathons/:challengeId?tab=Certificates",
        target: "cert-scope",
        placement: "bottom",
      },
      {
        id: "cert-type",
        title: "Winners and entrants get different certificates",
        body: "Winner and Participation are designed separately, so the team that placed first does not receive the same document as everyone who entered. Switching between them here swaps which design you are editing.",
        route: "/hackathons/:challengeId?tab=Certificates",
        target: "cert-type",
        placement: "bottom",
      },
      {
        id: "cert-artwork",
        title: "Your artwork, their name on it",
        body: "Upload the background and drag the fields — name, challenge, date — onto it. You are positioning placeholders, not typing anyone's details: each certificate is generated with the right team's name where the placeholder sits.",
        route: "/hackathons/:challengeId?tab=Certificates",
        placement: "bottom",
      },
      {
        id: "cert-issue",
        title: "Issuing them",
        body: "Issue sends a certificate to every entrant who did not win, using whichever design applies. It stays disabled until the challenge has ended — there is no final list of who placed where until then.",
        route: "/hackathons/:challengeId?tab=Certificates",
        target: "cert-issue",
        placement: "top",
        roles: ["client_admin", "admin", "event_manager"],
      },
      {
        id: "cert-reissue",
        title: "If you change the artwork afterwards",
        body: "Re-issuing regenerates with the current design. Certificates already sent keep the artwork they were made with, so fix the design first and re-issue once rather than several times.",
        route: "/hackathons/:challengeId?tab=Certificates",
        roles: ["client_admin", "admin", "event_manager"],
      },
    ],
  },

  // ═════════════════════════════════════════════════════════════════════════
  // Super Admin.
  //
  // A super admin runs the platform, not the events on it. They never create
  // an event, open applications, score a team or enrol a register — those are
  // the registrar's job. Their screens are oversight, access and capacity, so
  // the organiser tours above are not offered to them at all and these take
  // their place.
  // ═════════════════════════════════════════════════════════════════════════
  {
    id: "sa-registrars",
    label: "Registrars",
    description: "The firms on the platform and the registers beneath them.",
    roles: ["super_admin"],
    steps: [
      {
        id: "sa-rg-intro",
        title: "The shape of the platform",
        body: "A registrar is a firm that acts for listed companies. Each registrar holds registers — one per company — and every event on the platform belongs to one of those registers. Three levels: registrar, register, event.",
        route: "/registrars",
      },
      {
        id: "sa-rg-list",
        title: "Every registrar",
        body: "The firms enrolled on the platform, by status. Suspending one stops it hosting anything new without deleting its history.",
        route: "/registrars",
        target: "nav:/registrars",
        placement: "right",
      },
      {
        id: "sa-rg-detail",
        title: "Inside one",
        body: "Open a registrar to see its profile, the registers underneath it, and every event those registers are running. This is where you check what a firm is actually doing on the platform.",
        route: "/registrars",
      },
      {
        id: "sa-rg-enrol",
        title: "Bringing one on",
        body: "Enrol Registrar takes the firm's details and its representative. Approval is what lets them sign in and start creating registers of their own.",
        target: "nav:/registrars/enrol",
        placement: "right",
      },
      {
        id: "sa-rg-note",
        title: "You do not enrol registers",
        body: "Registers belong to the registrar that holds them, and they create their own. If a register is missing, the question is for that registrar rather than something to add from here.",
      },
    ],
  },

  {
    id: "sa-oversight",
    label: "Events & challenges",
    description: "Watching what is running across every registrar.",
    roles: ["super_admin"],
    steps: [
      {
        id: "sa-ov-intro",
        title: "Oversight, not operation",
        body: "You can see every event and every challenge on the platform, across all registrars. You do not run them — there is no Create Event, no live room and no scoring on your side. These screens answer what is happening and for whom.",
        route: "/events",
      },
      {
        id: "sa-ov-events",
        title: "Every event, everywhere",
        body: "All four kinds, across all registrars — AGMs, launches, challenges and general events. Registrar, register and type filters narrow it, and what you pick stays in the address bar, so a view is a link you can send.",
        route: "/events",
        target: "events-filters",
        placement: "bottom",
      },
      {
        id: "sa-ov-registrar-filter",
        title: "Narrowing to one firm",
        body: "Pick a registrar and the register filter appears beneath it, scoped to that firm's registers. That pair answers most \"what is this client doing\" questions on its own.",
        route: "/events",
        target: "events-filters",
        placement: "bottom",
      },
      {
        id: "sa-ov-challenges",
        title: "Innovation challenges",
        body: "The same view for challenges: every one on the platform, whoever is running it. Open one to read its brief, its applications and its leaderboard — as a reader. Opening applications, shortlisting, scoring and announcing winners all belong to the organiser.",
        route: "/hackathons",
        target: "nav:/hackathons",
        placement: "right",
      },
      {
        id: "sa-ov-challenge-detail",
        title: "Inside a challenge",
        body: "The tabs are the organiser's workflow, and you see the state of each: how many applied, who was shortlisted, which judges are assigned, whether scoring is open. Useful when a registrar asks why something is stuck.",
        route: "/hackathons",
      },
      {
        id: "sa-ov-documents",
        title: "Documents",
        body: "Every document published on the platform, filterable by registrar and register. Downloads are counted, which is what settles whether a notice actually reached people.",
        route: "/documents",
        target: "nav:/documents",
        placement: "right",
      },
    ],
  },

  {
    id: "sa-people",
    label: "Users & access",
    description: "Accounts, verification and who can sign in.",
    roles: ["super_admin"],
    steps: [
      {
        id: "sa-pp-intro",
        title: "Two kinds of account",
        body: "Shareholders, who attend events and vote, and client admins, who run a registrar's side of the platform. They are managed separately because they mean different things.",
        route: "/participants",
      },
      {
        id: "sa-pp-users",
        title: "All users",
        body: "Every shareholder account, searchable by name, email or phone — this one really is searched on the server, so it looks across all of them and not just the page you can see.",
        route: "/participants",
        target: "nav:/participants",
        placement: "right",
      },
      {
        id: "sa-pp-status",
        title: "Active, pending, suspended",
        body: "The tabs are account state, not verification state. Suspending stops someone signing in and keeps their record; rejected and pending are stages of enrolment rather than punishments.",
        route: "/participants",
      },
      {
        id: "sa-pp-kyc",
        title: "Verification",
        body: "Shareholders verify their identity before they can vote. Their KYC status shows against each account here, and the queue itself is worked by the registrar's own KYC officer rather than from this screen.",
        route: "/participants",
      },
      {
        id: "sa-pp-admins",
        title: "Client admins",
        body: "The people who run each registrar's account. This is where you see who has access to what, and suspend an account when a firm says someone has left.",
        route: "/admin/client-admins",
        target: "nav:/admin/client-admins",
        placement: "right",
      },
    ],
  },

  {
    id: "sa-zoom",
    label: "Zoom sessions",
    description: "The host pool and how meetings get a host.",
    roles: ["super_admin"],
    steps: [
      {
        id: "sa-zm-intro",
        title: "Why there is a pool at all",
        body: "A Zoom licence can host one meeting at a time. Registrars schedule AGMs independently of each other, so the platform keeps a pool of host licences and hands one to each event for its slot.",
        route: "/admin/zoom-sessions",
      },
      {
        id: "sa-zm-nav",
        title: "Where capacity lives",
        body: "This screen is the whole capacity picture: the licences you hold, what is holding one right now, and what is queued behind them.",
        target: "nav:/admin/zoom-sessions",
        placement: "right",
      },
      {
        id: "sa-zm-pool",
        title: "The host pool",
        body: "Each licence in the pool can carry one live meeting. Two AGMs at ten o'clock need two hosts — if the pool is smaller than the demand, something has to move.",
        route: "/admin/zoom-sessions",
      },
      {
        id: "sa-zm-assign",
        title: "Assigning a host",
        body: "An event can be given a host directly. That is the manual override for the case the automatic assignment could not cover — usually a clash, or an event added at short notice.",
        route: "/admin/zoom-sessions",
      },
      {
        id: "sa-zm-held",
        title: "Held slots",
        body: "A held slot is a licence reserved for an event that has not started yet. They are what tells you whether tomorrow morning is already full, which is the question worth asking before a registrar schedules another AGM into it.",
        route: "/admin/zoom-sessions",
      },
    ],
  },

  {
    id: "sa-analytics",
    label: "Analytics & audit",
    description: "Platform numbers, and the record of who did what.",
    roles: ["super_admin"],
    steps: [
      {
        id: "sa-an-intro",
        title: "Two different questions",
        body: "Analytics answers how the platform is being used. The audit log answers who did a particular thing and when. Reach for the first for trends and the second for incidents.",
        route: "/analytics",
      },
      {
        id: "sa-an-range",
        title: "One window drives everything",
        body: "The period you pick applies to every card on the page, so the numbers are always comparable with each other. It stays in the address bar, which makes a particular view something you can send to someone.",
        route: "/analytics",
        target: "nav:/analytics",
        placement: "right",
      },
      {
        id: "sa-an-cards",
        title: "What is counted",
        body: "Events by type, top organisers, verification breakdown, event formats. Counted by event date rather than when the record was created — so a window is about what happened in it, not what was typed in it.",
        route: "/analytics",
      },
      {
        id: "sa-an-audit",
        title: "The audit log",
        body: "Every action on the platform with its actor, resource and severity. Filter by category, severity, user email, entity or date range — and every one of those stays in the URL, so an investigation can be handed over as a link.",
        route: "/audit",
        target: "nav:/audit",
        placement: "right",
      },
      {
        id: "sa-an-export",
        title: "Getting it out",
        body: "Export all, or select the rows that matter and export those. That file is what goes to whoever asked the question.",
        route: "/audit",
      },
      {
        id: "sa-an-test",
        title: "Test accounts",
        body: "Generated accounts for exercising a flow without touching a real registrar's data. Useful before a release; keep them out of anything you are measuring.",
        target: "nav:/admin/test-users",
        placement: "right",
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Judging — the judge's own experience.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "judging",
    label: "Judging",
    description: "Scoring teams and reading the leaderboard.",
    // Judge-only. A client admin manages judges from the challenge's Judges
    // tab; they never score anything, so a tour about entering marks was
    // describing a screen they do not have.
    roles: ["judge"],
    steps: [
      {
        id: "jd-intro",
        title: "What you have been asked to do",
        body: "You have been assigned to one or more innovation challenges. For each, you read the shortlisted teams' submissions and score them against the criteria the organiser set.",
        route: "/",
      },
      {
        id: "jd-dashboard",
        title: "Your assignments",
        body: "Every challenge you are judging, with how many teams you have scored and how many are still waiting on you. The pending count is the one to watch.",
        route: "/",
        target: "judge-dashboard",
        placement: "top",
        roles: ["judge"],
      },
      {
        id: "jd-challenges",
        title: "The challenges themselves",
        body: "Open a challenge to read its brief and see the teams. You see what the organiser published — the same material the teams were given.",
        route: "/hackathons",
        target: "nav:/hackathons",
        placement: "right",
      },
      {
        id: "jd-judging",
        title: "Where you score",
        body: "The Judging screen lists your shortlisted teams. Open one, read the submission, and score each criterion. Your scores save as you go.",
        route: "/hackathons/judging",
        target: "nav:/hackathons/judging",
        placement: "right",
      },
      {
        id: "jd-criteria",
        title: "Scoring against criteria",
        body: "Each criterion carries a weight set by the organiser, and they total 100%. You score each one on its own; the weighting is applied for you, so score what is in front of you rather than trying to do the arithmetic.",
        placement: "bottom",
      },
      {
        id: "jd-scoring-closed",
        title: "If you cannot enter scores",
        body: "Scoring is a switch the organiser controls. If the fields are locked, scoring has not been opened yet — or the challenge has ended. Neither is something you can change from here.",
        placement: "bottom",
      },
      {
        id: "jd-leaderboard",
        title: "The leaderboard",
        body: "Ranks teams by weighted score across every judge as marks come in. Your own scores are only part of it, so the order will move as other judges submit.",
        placement: "bottom",
      },
    ],
  },
];

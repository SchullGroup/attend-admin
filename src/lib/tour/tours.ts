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
        body: "The sidebar is grouped by what you are doing rather than by screen: running events, running challenges, managing the companies you act for, and the system records underneath. You only see the groups your role can reach.",
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
      },
      {
        id: "welcome-documents",
        title: "Documents and analytics",
        body: "Every notice, agenda and report you have published, in one vault — and the numbers underneath: turnout, fill rates, verification. Both filter by register and by event.",
        target: "nav:/documents",
        placement: "right",
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
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "challenges",
    label: "Innovation Challenges",
    description: "From brief to announcing winners.",
    roles: ["super_admin", "client_admin", "admin", "event_manager", "viewer"],
    steps: [
      {
        id: "ch-intro",
        title: "How a challenge runs",
        body: "Seven stages, in order: write the brief, decide what teams submit, open applications, shortlist, assign judges, score, announce. Each stage has a tab, and they are laid out left to right in the order you use them.",
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
        body: "This panel is the same sequence in writing, and it stays on the page after this tour ends. Dismiss it once you know the flow — it will collapse to a button you can reopen.",
        route: "/hackathons",
        target: "challenge-guide",
        placement: "bottom",
      },
      {
        id: "ch-settings",
        title: "Decide what teams submit — first",
        body: "The Settings tab defines the application form: the questions, the fields, the file uploads. Set this before you open applications. Changing it afterwards means early teams answered different questions from later ones, and you cannot compare them fairly.",
        placement: "bottom",
      },
      {
        id: "ch-open",
        title: "Opening applications",
        body: "The toggle on Overview is what makes the challenge visible to teams. The app will ask you to check your form first — that prompt is there because the form is the one thing that is genuinely painful to change later.",
        placement: "bottom",
      },
      {
        id: "ch-applications",
        title: "Reading what came in",
        body: "The Applications tab lists every team with its idea, track and members. The status pills across the top are the pipeline: Submitted, Under Review, Shortlisted, Selected, Not Progressed. Move teams along as you read them.",
        placement: "bottom",
      },
      {
        id: "ch-shortlist",
        title: "Shortlisted is the one that matters",
        body: "Only shortlisted teams reach the judges. That is the gate between everyone who applied and the group that actually gets scored, so it is worth being deliberate about.",
        placement: "bottom",
      },
      {
        id: "ch-tracks",
        title: "Tracks",
        body: "If your challenge has themes — Payments, Lending, whatever you set — teams pick one when they apply, and you can filter and judge by track. Useful when you want a winner per theme rather than one overall.",
        placement: "bottom",
      },
      {
        id: "ch-judges",
        title: "Judges and scoring",
        body: "Add judges from your own team on the Judges tab, then turn Scoring on. Until you do, judges can see their assignments but cannot enter marks — which is what you want while you are still shortlisting.",
        placement: "bottom",
      },
      {
        id: "ch-criteria",
        title: "Criteria and weights",
        body: "Scoring criteria are set when the challenge is created and must add up to 100%. Each new criterion starts at 20%, so you adjust the others to balance it — that trade-off is deliberate, it makes you decide what actually matters.",
        placement: "bottom",
      },
      {
        id: "ch-leaderboard",
        title: "The leaderboard",
        body: "Ranks shortlisted teams by weighted score as judges submit. It updates on its own — no recalculation step, and nothing to publish before you can read it.",
        placement: "bottom",
      },
      {
        id: "ch-end",
        title: "Ending it",
        body: "Ending the challenge locks application statuses for good. Do it once judging is genuinely finished: after that point you cannot move a team between statuses, by design, so the record of what was decided stays fixed.",
        placement: "bottom",
      },
      {
        id: "ch-winners",
        title: "Winners and certificates",
        body: "Announce winners on the Winners tab, then generate certificates from the Certificates tab. Certificates use a template you design once — position the name and the date on your artwork and it applies to every team.",
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
    description: "Creating an event through to the live room and the vote.",
    roles: ["super_admin", "client_admin", "admin", "event_manager", "viewer"],
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
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. Registers & shareholders.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "registers",
    label: "Registers & shareholders",
    description: "Enrolling a company and loading its shareholders.",
    roles: ["super_admin", "client_admin", "admin", "event_manager", "viewer", "kyc_officer"],
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
        id: "rg-kyc",
        title: "Verification",
        body: "Shareholders verify their identity before they can vote. The KYC queue is where those submissions are reviewed and approved or sent back.",
        route: "/participants/kyc",
        placement: "bottom",
        roles: ["super_admin", "kyc_officer", "client_admin", "admin"],
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
  // 5. Judging — the judge's own experience.
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: "judging",
    label: "Judging",
    description: "Scoring teams and reading the leaderboard.",
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

// Super Admin Response Types

// ---------------------------------------------------------------------------
// Organisation Registers — /api/v1/admin/registers
// ---------------------------------------------------------------------------
export type RegisterStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

/**
 * One row returned by GET /api/v1/admin/registers/{id}/documents
 * (Document Vault tab on the Register detail page)
 *
 * Field contract (from admin API spec):
 *   title         — document filename string
 *   eventTitle    — meeting/event context scope the document belongs to
 *   fileSizeBytes — raw byte count; formatted to KB/MB in the UI
 *   downloadCount — cumulative download click counter
 *   uploadedAt    — ISO timestamp the document was uploaded
 */
export interface RegisterDocumentItem {
  id:            string;
  title:         string;
  eventTitle?:   string | null;
  fileSizeBytes: number;
  downloadCount: number;
  uploadedAt:    string;
  /** Optional extras that may be present in the payload */
  fileType?:     string;
  mimeType?:     string;
  url?:          string;
}

/**
 * One row returned by GET /api/v1/admin/stakeholders (Registers directory listing).
 *
 * Date field contract:
 *   enrolledAt  — primary timestamp, set when the org was approved/activated
 *   approvedAt  — legacy alias used by some backend versions
 *   createdAt   — kept for backward compat; do NOT use as the display date
 */
export interface RegisterItem {
  id:           string;
  name:         string;
  companyName?: string;    // some payloads return companyName rather than name
  industry?:    string | null;
  status:       RegisterStatus;
  email?:       string;
  phone?:       string;
  rcNumber?:    string | null;
  eventCount?:          number;
  enrolledAt?:          string;    // ← preferred display date (spec primary key)
  approvedAt?:          string;    // ← fallback display date
  createdAt?:           string;    // ← present in legacy payloads; not used for display
  representativeName?:  string;
  representativePhone?: string;
}

/** Full profile returned by GET /api/v1/admin/registers/{id} */
export interface RegisterDetailResponse {
  id:           string;
  name:         string;
  industry?:    string;
  status:       RegisterStatus;
  email?:       string;
  phone?:       string;
  rcNumber?:    string;
  domain?:      string;
  adminEmail?:  string;
  createdAt?:   string;
  events?:      { id: string; title: string; status: string; date: string }[];
  documents?:   { id: string; title: string; fileType: string }[];
}

/** One item inside data.pending[] from GET /api/v1/admin/registers/pending */
export interface PendingRegisterItem {
  id:           string;
  name:         string;
  industry?:    string;
  email?:       string;
  phone?:       string;
  rcNumber?:    string;
  requestedAt?: string;
  requestedAgo?:string;
}

/** Envelope shape for GET /api/v1/admin/stakeholders (UI: Registers list) */
export interface RegistersListResponse {
  /**
   * Spec response key from /api/v1/admin/stakeholders: `registrars`
   * Both `registrars` and `registers` are populated — use whichever your
   * consumer was already reading; they always point to the same array.
   */
  registrars:    RegisterItem[];
  /** Backward-compat alias — equals `registrars` */
  registers:     RegisterItem[];
  totalCount:    number;
  page:          number;
  size:          number;
  totalPages?:   number;
}

/** Envelope shape for GET /api/v1/admin/registers/pending */
export interface PendingRegistersResponse {
  pending:       PendingRegisterItem[];
  totalCount:    number;
  page:          number;
  size:          number;
}

/**
 * POST /api/v1/admin/stakeholders/enroll
 * UI label: "Enrol New Register" — backend path: /stakeholders/enroll
 * Spec-exact body contract: { companyName, industry, rcNumber, contactEmail, plan }
 */
export interface EnrollRegisterRequest {
  companyName:  string;
  industry?:    string;
  rcNumber?:    string;
  contactEmail: string;
  plan?:        string;
}

/** POST /api/v1/admin/registers/{id}/reject body */
export interface RejectRegisterRequest {
  reason?: string;
}

/** POST /api/v1/admin/registers/{id}/suspend body */
export interface SuspendRegisterRequest {
  reason?: string;
}

// ---------------------------------------------------------------------------
// Generic paged envelope that matches the server's PagedResponse shape
// ---------------------------------------------------------------------------
export interface PagedApiResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface PlatformStatsResponse {
  totalStakeholders: number;
  totalUsers: number;
  totalEvents: number;
  totalRsvps: number;
}

/** Matches GET /api/v1/admin/dashboard/stats — new nested shape */
export interface DashboardStatsResponse {
  enrolledStakeholders: { count: number; color: string };
  totalEvents:          { count: number; color: string };
  liveNow:              { count: number; onlineCount: number; label: string };
  pendingKYC:           { count: number; color: string };
  /**
   * Present when at least one event is live.
   * `null` when no events are currently live.
   */
  liveBanner: {
    eventId:       string;
    organizerName: string;
    onlineCount:   number;
    live:          boolean;
  } | null;
}

export interface ClientAdminResponse {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  status: string;
  stakeholderId: string;
  stakeholderName: string;
}

export interface StakeholderSummaryResponse {
  id: string;
  name: string;
  industry?: string;
  eventCount?: number;
  online?: boolean;
}

export interface EnrollmentResponse {
  id: string;
  name: string;
  domain: string;
  status: string;
  message: string;
}

export interface PendingItem {
  id: string;
  companyName: string;
  industry?: string;
  rcNumber?: string;
  contactEmail: string;
  plan?: string;
  status: string;
  requestedAt: string;
  requestedAgo?: string;
}

export interface PendingEnrollmentsResponse {
  totalCount: number;
  label?: string;
  page: number;
  size: number;
  pendingStakeholders: PendingItem[];
}

export interface EventSummaryResponse {
  id: string;
  title: string;
  status: string;
  date: string;
  startTime: string;
  format: "VIRTUAL" | "IN_PERSON" | "HYBRID";
  live: boolean;
  /**
   * PRIMARY organizer field returned by GET /api/v1/client/events.
   * Always use this for the "Organizer" UI element when present.
   */
  registerName?: string;
  /**
   * Alias returned by some admin endpoints — same meaning as registerName.
   * Prefer registerName; fall back to this.
   */
  organizerName?: string;
  /** Legacy alias — same meaning as registerName. */
  stakeholderName?: string;
  registrationCount:      number;
  registrationPercentage: number;
  /** Maximum attendee capacity — use this directly for "X of Y" display. 0 = unlimited. */
  maximumCapacity?:       number;
  tags:       string[];
  /** AGM_EGM | PRODUCT_LAUNCH | INNOVATION_CHALLENGE | HACKATHON | GENERAL_EVENT */
  eventType?: string;
  startDate?: string;
  endDate?:   string;
  registerId?: string;
  rsvpEnabled?: boolean;
}

export interface AgendaItemResponse {
  id: string;
  order: number;
  title: string;
  description?: string;
  durationMinutes: number;
  speakerName?: string;
  isCurrent?: boolean;
}

export interface SpeakerResponse {
  id: string;
  name: string;
  role: string;
  company?: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Polymorphic event-type config blocks — GET /api/v1/admin/events/{id}
// ---------------------------------------------------------------------------
export interface AgmConfig {
  quorumThreshold: number;
  votingEnabled: boolean;
  resolutions?: Array<{
    id: string;
    title: string;
    description?: string;
    order: number;
    status: "PENDING" | "OPEN" | "CLOSED" | "PASSED" | "FAILED";
    forVotes: number;
    againstVotes: number;
    abstainVotes: number;
  }>;
  proxyVotingEnabled?: boolean;
  shareholderVerification?: boolean;
}

export interface ProductLaunchConfig {
  productName: string;
  productCategory?: string;
  targetAudience?: string;
  pressKitUrl?: string;
  demoUrl?: string;
  launchGoals?: string[];
}

export interface InnovationChallengeConfig {
  tracks: string[];
  maxTeamSize: number;
  submissionDeadline?: string;
  judgingCriteria?: Array<{
    name: string;
    weight: number;
  }>;
  prizePool?: string;
}

export interface GeneralEventConfig {
  category?: string;
  tags?: string[];
  registrationDeadline?: string;
  allowWalkIns?: boolean;
}

export type EventTypeConfig =
  | { eventType: "AGM_EGM";             agmConfig: AgmConfig;                         productLaunchConfig?: never; innovationChallengeConfig?: never; generalEventConfig?: never }
  | { eventType: "PRODUCT_LAUNCH";      productLaunchConfig: ProductLaunchConfig;      agmConfig?: never;           innovationChallengeConfig?: never; generalEventConfig?: never }
  | { eventType: "INNOVATION_CHALLENGE" | "HACKATHON"; innovationChallengeConfig: InnovationChallengeConfig; agmConfig?: never; productLaunchConfig?: never; generalEventConfig?: never }
  | { eventType: "GENERAL_EVENT";       generalEventConfig: GeneralEventConfig;        agmConfig?: never;           productLaunchConfig?: never; innovationChallengeConfig?: never };

export type EventDetailResponse = {
  id: string;
  /** Name of the register/organisation that owns the event (preferred display value). */
  organizerName?: string;
  /** Registrar-firm name alias — use organizerName for display instead. */
  stakeholderName: string;
  title: string;
  description: string;
  format: "VIRTUAL" | "IN_PERSON" | "HYBRID";
  date: string;
  startTime: string;
  streamUrl?: string;
  location?: string;
  venue?: string;
  endDate?: string;
  endTime?: string;
  maximumCapacity?: number;
  featured?: boolean;
  status: "DRAFT" | "PUBLISHED" | "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
  registrationCount: number;
  agenda?: AgendaItemResponse[];
  speakers?: SpeakerResponse[];
  overview?: {
    /** Nested RSVP object returned by the server — use .count and .capacity for bar maths */
    rsvps: {
      count:    number;
      capacity: number;
    };
    verifiedAttendees: number;
    documents:         number;
  };
  createdAt: string;
  updatedAt: string;
} & EventTypeConfig;


/** Matches GET /api/v1/admin/registrations response content items */
export interface RegistrationSummaryResponse {
  id: string;
  participantName: string;
  email: string;
  initials: string;
  avatarColor: string;
  kycStatus: string;
  registeredAgo: string;
  registeredAt: string;
  // Legacy fields kept for backward compat with existing dashboard usage
  eventId?: string;
  eventTitle?: string;
  participantEmail?: string;
  status?: string;
}

export interface NotificationResponse {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: string;
}

export interface NotificationListResponse {
  content: NotificationResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ---------------------------------------------------------------------------
// Global Search  — GET /api/v1/admin/search
// ---------------------------------------------------------------------------
export interface SearchEventResult {
  id: string;
  title: string;
  status: string;
  date: string;
}

export interface SearchParticipantResult {
  id: string;
  fullName: string;
  email: string;
  kycStatus: string;
}

export interface SearchStakeholderResult {
  id: string;
  name: string;
  industry: string;
}

export interface SearchResponse {
  query: string;
  totalResults: number;
  events: SearchEventResult[];
  participants: SearchParticipantResult[];
  stakeholders: SearchStakeholderResult[];
}

export interface SearchParams {
  q: string;
  page?: number;
  limit?: number;
}

export interface UserSummaryResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  /** Alias for role — present on some response shapes */
  role?: string;
  roles?: string[];
  phone?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  kycStatus?: string | null;
  emailVerified?: boolean;
  stakeholderName?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Client Admins — GET /api/v1/admin/client-admins
// ---------------------------------------------------------------------------

export interface ClientAdminAdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
}

export interface ClientAdminItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  industry?: string | null;
  website?: string | null;
  status: string;
  createdAt: string;
  admin?: ClientAdminAdminUser | null;
}

// Participants & KYC Types

export interface ParticipantListResponse {
  totalCount: number;
  page: number;
  size: number;
  participants: ParticipantItem[];
}

export interface ParticipantItem {
  id: string;
  displayId: string;
  fullName: string;
  initials: string;
  avatarColor: string;
  email: string;
  phone: string;
  kycStatus: string;
  kycLabel: string;
  accountStatus: string;
  joinedAt: string;
  joinedLabel: string;
  eventsAttended: number;
}

export interface ParticipantDetailResponse {
  id: string;
  displayId: string;
  fullName: string;
  initials: string;
  avatarColor: string;
  email: string;
  phone: string;
  joinedAt: string;
  joinedLabel: string;
  accountStatus: string;
  kycStatus: string;
  kycLevel: string;
  kyc: {
    status: string;
    statusLabel: string;
    description: string;
    bvn: string;
    nin: string;
    chn: string;
  };
  platformActivity: {
    eventsAttended: number;
    credentialsVerified: number;
  };
  accountInfo: {
    accountId: string;
    accountStatus: string;
    registeredAt: string;
    registeredLabel: string;
    kycLevel: string;
  };
}

export interface CredentialField {
  value: string;
  maskedValue: string;
  verified: boolean;
  verifiedAt: string;
}

export interface ParticipantKycDetailResponse {
  participantId: string;
  fullName: string;
  kycStatus: string;
  submittedAt: string;
  credentials?: {
    bvn?: CredentialField;
    nin?: CredentialField;
    chn?: CredentialField;
  };
}

/**
 * Individual row returned by GET /api/v1/admin/participants/kyc/queue
 * Fields come from the list endpoint — different from the detail endpoint.
 */
export interface KycQueueItem {
  id:            string;
  participantId?: string;   // alias — same as id on some response shapes
  displayId?:    string;
  fullName:      string;
  email?:        string;
  phone?:        string;
  kycStatus:     string;
  accountStatus?: string;
  submittedAgo?: string;
  submittedAt?:  string;
  bvnProvided?:  boolean;
  chnProvided?:  boolean;
  avatarColor?:  string;
  // Detail shape — present when fetched via the detail endpoint
  credentials?: {
    bvn?: CredentialField;
    nin?: CredentialField;
    chn?: CredentialField;
  };
}

/** Matches GET /api/v1/admin/participants/kyc/queue — array is under `queue`, NOT `content` */
export interface KycQueueResponse {
  queue:       KycQueueItem[];   // primary spec key
  totalCount:  number;
  page:        number;
  size:        number;
  totalPages?: number;
  // Alias fallback
  content?:    KycQueueItem[];
}

export interface GlobalDocumentListResponse {
  content: any[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

// ---------------------------------------------------------------------------
// Single event document  — GET /api/v1/admin/events/{id}/documents/{documentId}
// ---------------------------------------------------------------------------
export interface EventDocumentDetailResponse {
  id:               string;
  title:            string;
  documentType?:    string;
  fileType:         string;
  mimeType:         string;
  originalFilename: string;
  sizeBytes:        number;
  sizeLabel?:       string;
  uploadedAt?:      string;
  downloadCount?:   number;
  /** Direct download URL returned by the admin detail endpoint. */
  fileUrl?:         string;
  /** Legacy base64 payload — may be present on older API versions. */
  fileData?:        string;
}

/** Shape of each item in GET /api/v1/admin/events/{id}/documents */
export interface EventDocumentSummary {
  id:            string;
  title:         string;
  eventId?:      string;
  eventTitle?:   string;
  documentType?: string;
  fileType?:     string;
  sizeBytes?:    number;
  sizeLabel?:    string;
  downloadCount?: number;
}

// Super Admin Request Types

export interface EnrollStakeholderRequest {
  name: string;
  domain: string;
  adminEmail: string;
  adminFirstName: string;
  adminLastName: string;
}

export interface RejectEnrollmentRequest {
  reason: string;
}

export interface SuspendParticipantRequest {
  reason: string;
}

/** POST /api/users — create a standalone individual user account */
export interface CreateUserRequest {
  firstName:   string;
  lastName:    string;
  email:       string;
  phone?:      string;
  password?:   string;
  /** Defaults to "USER" on the server if omitted */
  role?:       string;
}

/** POST /api/v1/admin/users/{userId}/suspend — suspend a single user account */
export interface SuspendUserAccountRequest {
  reason?: string;
}

export interface KycApproveRequest {
  kycLevel?: string;
  note?: string;
  notes?: string;
}

export interface KycDeclineRequest {
  reason: string;
}

// ---------------------------------------------------------------------------
// Event Creation Request Types — one per backend route
// ---------------------------------------------------------------------------

/** Resolution item — body field is `specialResolution` (not `isSpecial`) */
export interface AgmResolutionInput {
  title:              string;
  description?:       string;
  specialResolution?: boolean;   // swagger key — was `isSpecial`
}

/** POST /api/v1/admin/events/agm — field names match swagger exactly */
export interface CreateAgmEventRequest {
  registerId:              string;        // was stakeholderId
  title:                   string;
  description?:            string;
  date:                    string;        // YYYY-MM-DD
  startTime:               string;        // HH:mm — swagger key `startTime`
  format:                  "VIRTUAL" | "IN_PERSON" | "HYBRID";
  venue?:                  string;
  streamUrl?:              string;
  maximumCapacity?:        number;
  agenda?:                 Array<{ time: string; title: string; speaker?: string }>;
  shareholderTargeting?:   "ALL_REGISTERED" | "CUSTOM";
  enableProxyVoting?:      boolean;       // swagger key — was `proxyEnabled`
  quorumPercentage?:       number;        // integer
  eligibilityCutOffDate?:  string;        // swagger key — was `eligibilityCutoffDate`
  agmNoticeBase64?:        string;        // swagger key — was `noticeFileBase64`
  agmNoticeFilename?:      string;
  shareholderListBase64?:  string;
  shareholderListFilename?: string;
  resolutions?:            AgmResolutionInput[];
}

/** POST /api/v1/admin/events/general — field names match swagger exactly */
export interface CreateGeneralEventRequest {
  registerId:          string;            // was stakeholderId
  title:               string;
  description?:        string;
  date:                string;
  startTime:           string;            // swagger key — was `time`
  format:              "VIRTUAL" | "IN_PERSON" | "HYBRID";
  venue?:              string;
  streamUrl?:          string;
  maximumCapacity?:    number;            // swagger key — was `maxCapacity`
  audienceTargeting?:  "OPEN_REGISTRATION" | "INVITE_ONLY";  // was `audienceTargetingChannel: "OPEN"|"INVITE"`
  agenda?:             Array<{ time: string; title: string; speaker?: string }>;
}

export interface InnovationPrizeInput    { position: string; reward: string; }  // `position` was `place`
export interface InnovationCriteriaInput { criterion: string; weight: number; } // `criterion`/`weight` were `label`/`weightPercent`

/**
 * POST /api/v1/admin/events/innovation — field names match swagger exactly
 * judgingCriteria weights must sum to 100 if provided.
 */
export interface CreateInnovationEventRequest {
  registerId:           string;           // was stakeholderId
  title:                string;
  eventType?:           "INNOVATION_CHALLENGE" | "HACKATHON";
  themeTrack?:          string;           // was `theme`
  startDate:            string;
  endDate:              string;
  startTime?:           string;           // HH:mm
  format:               "VIRTUAL" | "IN_PERSON" | "HYBRID";
  venue?:               string;
  streamUrl?:           string;
  problemStatement?:    string;           // was `problemStatementBrief`
  expectedDeliverable?: string;           // was `rulesSummary`
  submissionDeadline?:  string;
  allowedTechStack?:    string;           // was `techStack`
  participationType?:   "SOLO" | "TEAM" | "SOLO_AND_TEAM";
  minTeamSize?:         number;
  maxTeamSize?:         number;
  eligibilityCriteria?: string;           // was `eligibility`
  maximumEntries?:      number;
  prizeTiers?:          InnovationPrizeInput[];   // was `prizes`
  judgingCriteria?:     InnovationCriteriaInput[];
}

/** Speaker shape — `roleTitle` is the swagger key (not `role`) */
export interface ProductLaunchSpeakerInput { name: string; roleTitle: string; bio?: string; }

/** POST /api/v1/admin/events/product-launch — field names match swagger exactly */
export interface CreateProductLaunchEventRequest {
  registerId:          string;            // was stakeholderId
  title:               string;
  date:                string;
  startTime:           string;            // swagger key — was `time`
  format:              "VIRTUAL" | "IN_PERSON" | "HYBRID";
  venue?:              string;
  streamUrl?:          string;
  maximumCapacity?:    number;            // was `maxCapacity`
  productName?:        string;
  tagline?:            string;
  productDescription?: string;
  micrositeSlug?:      string;
  audienceTargeting?:  "OPEN_REGISTRATION" | "INVITE_ONLY";  // was `audienceMode`
  embargo?: {
    enabled:    boolean;
    releaseAt?: string;                   // ISO datetime
  };                                      // was `embargoEnabled` + `embargoReleaseAt` flat fields
  speakers?:           ProductLaunchSpeakerInput[];
}

// ---------------------------------------------------------------------------
// Client Register Detail — GET /api/v1/client/registers/{registerId}
// ---------------------------------------------------------------------------

/**
 * Embedded event row inside ClientRegisterDetailResponse.
 * Matches the swagger response shape for GET /api/v1/client/registers/{registerId}.
 */
export interface ClientRegisterEventItem {
  id:               string;
  title:            string;
  eventType:        string;
  format:           string;
  status:           string;
  date:             string;
  startTime?:       string;
  venue?:           string;
  streamUrl?:       string;
  organizerName?:   string;
  organizerLogo?:   string;
  maximumCapacity?: number;
  rsvpEnabled?:     boolean;
  registered?:      boolean;
}

/**
 * Full register profile returned by GET /api/v1/client/registers/{registerId}
 *
 * Response envelope: data (flat object, not nested)
 * Nullable fields: rcNumber, industry — render as italic dash "—" in the UI
 * Date: enrolledAt (swagger primary key, format: YYYY-MM-DD)
 */
export interface ClientRegisterDetailResponse {
  id:                   string;
  name:                 string;
  email?:               string;
  rcNumber?:            string | null;
  industry?:            string | null;
  representativeName?:  string;
  representativePhone?: string;
  status:               string;
  enrolledAt?:          string;
  approvedAt?:          string;   // legacy fallback date alias
  eventCount?:          number;
  events?:              ClientRegisterEventItem[];
}

/**
 * Legacy alias kept so existing hooks compile without changes.
 * New code should use PagedApiResponse<T> which includes `last`.
 */
export type PagedResponse<T> = PagedApiResponse<T> & { number?: number };

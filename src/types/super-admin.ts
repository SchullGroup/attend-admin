// Super Admin Response Types

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

export interface DashboardStatsResponse {
  activeStakeholders: number;
  pendingEnrollments: number;
  liveEvents: number;
  totalUsers: number;
  recentActivityCount: number;
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
  organizerName: string;
  registrationCount: number;
  registrationPercentage: number;
  tags: string[];
  // Fallbacks for backward compatibility
  stakeholderName?: string;
  startDate?: string;
  endDate?: string;
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
  stakeholderName: string;
  title: string;
  description: string;
  format: "VIRTUAL" | "IN_PERSON" | "HYBRID";
  date: string;
  startTime: string;
  streamUrl?: string;
  location?: string;
  maximumCapacity?: number;
  status: "DRAFT" | "PUBLISHED" | "UPCOMING" | "LIVE" | "ENDED" | "CANCELLED";
  registrationCount: number;
  agenda?: AgendaItemResponse[];
  speakers?: SpeakerResponse[];
  overview?: {
    rsvps: number;
    verifiedAttendees: number;
    documents: number;
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
  role: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  createdAt: string;
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

export interface KycQueueResponse {
  content: ParticipantKycDetailResponse[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface GlobalDocumentListResponse {
  content: any[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
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

export interface KycApproveRequest {
  kycLevel?: string;
  note?: string;
  notes?: string;
}

export interface KycDeclineRequest {
  reason: string;
}

/**
 * Legacy alias kept so existing hooks compile without changes.
 * New code should use PagedApiResponse<T> which includes `last`.
 */
export type PagedResponse<T> = PagedApiResponse<T> & { number?: number };

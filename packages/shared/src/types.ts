// packages/shared/src/types.ts
// Single source of truth for data shapes shared between API and Web.
// These mirror the Prisma models but are plain TypeScript interfaces —
// no Prisma dependency required in the frontend.

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS (mirrored from Prisma schema)
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = "RESEARCHER" | "ADMIN";

export type PublicationType =
  | "JOURNAL_ARTICLE"
  | "CONFERENCE_PAPER"
  | "BOOK_CHAPTER"
  | "BOOK"
  | "PREPRINT"
  | "THESIS"
  | "DATASET"
  | "REPORT"
  | "OTHER";

export type DataSource =
  | "ORCID"
  | "OPEN_ALEX"
  | "SEMANTIC_SCHOLAR"
  | "CROSSREF"
  | "MANUAL";

export type PolicyDocumentType =
  | "UN_REPORT"
  | "GOVERNMENT"
  | "PARLIAMENT"
  | "NGO_REPORT"
  | "REGULATORY"
  | "OTHER";

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type RecommendationType =
  | "OPEN_ACCESS"
  | "POLICY_SUBMISSION"
  | "PREPRINT_UPLOAD"
  | "ORCID_COMPLETE"
  | "PROFILE_COMPLETE"
  | "COLLABORATION"
  | "CONFERENCE";

export type ImpactLevel = "LOW" | "MEDIUM" | "HIGH";

// ─────────────────────────────────────────────────────────────────────────────
// CORE DOMAIN TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: boolean;
  createdAt: string; // ISO 8601 string (dates are serialized over the wire)
}

export interface CoAuthor {
  name: string;
  orcidId?: string;
  openAlexId?: string;
}

export interface Publication {
  id: string;
  researcherId: string;
  doi?: string;
  openAlexId?: string;
  title: string;
  abstract?: string;
  year?: number;
  type: PublicationType;
  journalName?: string;
  venueName?: string;
  citationCount: number;
  openAccess: boolean;
  openAccessUrl?: string;
  coAuthors?: CoAuthor[];
  source: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyMention {
  id: string;
  publicationId: string;
  policyTitle: string;
  policyUrl?: string;
  policyType: PolicyDocumentType;
  country?: string;
  year?: number;
  organization?: string;
  source: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// VISIBILITY SCORE
// The breakdown type is important — this is what we show users to explain
// WHY their score is what it is.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreComponentBreakdown {
  score: number;        // 0–100
  weight: number;       // The weight applied in the composite (e.g. 0.30)
  contribution: number; // score * weight
  explanation: string;  // Human-readable explanation, e.g. "h-index of 12 in CS"
  dataPoints: string[]; // Specific facts backing this, e.g. ["420 citations", "h=12"]
}

export interface VisibilityScoreBreakdown {
  citation: ScoreComponentBreakdown;
  velocity: ScoreComponentBreakdown;
  policy: ScoreComponentBreakdown;
  openAccess: ScoreComponentBreakdown;
  collaboration: ScoreComponentBreakdown;
}

export interface VisibilityScore {
  id: string;
  researcherId: string;
  overallScore: number;
  citationScore: number;
  velocityScore: number;
  policyScore: number;
  openAccessScore: number;
  collaborationScore: number;
  breakdown: VisibilityScoreBreakdown;
  algorithmVersion: string;
  computedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESEARCHER PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export interface Researcher {
  id: string;
  userId: string;
  orcidId?: string;
  openAlexId?: string;
  displayName: string;
  institution?: string;
  department?: string;
  country?: string;
  fields: string[];
  bio?: string;
  websiteUrl?: string;
  twitterHandle?: string;
  // Cached aggregates
  hIndex: number;
  totalCitations: number;
  publicationCount: number;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  researcherId: string;
  type: RecommendationType;
  title: string;
  body: string;
  impact: ImpactLevel;
  isActioned: boolean;
  isDismissed: boolean;
  resourceUrl?: string;
  createdAt: string;
}

export interface SyncJob {
  id: string;
  researcherId: string;
  source: DataSource;
  status: JobStatus;
  trigger: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  itemsFound: number;
  itemsProcessed: number;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API RESPONSE WRAPPERS
// All API responses follow this envelope pattern for consistency.
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;    // Machine-readable: "NOT_FOUND", "UNAUTHORIZED", etc.
    message: string; // Human-readable
    details?: unknown; // Validation errors, etc.
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Paginated list responses
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// API REQUEST SHAPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresAt: string;
}

export interface UpdateProfileRequest {
  displayName?: string;
  institution?: string;
  department?: string;
  country?: string;
  fields?: string[];
  bio?: string;
  websiteUrl?: string;
  twitterHandle?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD AGGREGATE
// Single response shape for the main dashboard page —
// avoids N round-trips on first load.
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardData {
  researcher: Researcher;
  latestScore: VisibilityScore | null;
  // Score history for sparkline chart (last 12 data points)
  scoreHistory: Array<{ computedAt: string; overallScore: number }>;
  recentPublications: Publication[];
  pendingRecommendations: Recommendation[];
  activeSync: SyncJob | null;
}

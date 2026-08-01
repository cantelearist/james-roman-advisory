export const ENGAGEMENT_SORT_FIELDS = [
  "updated_at",
  "title",
  "client",
  "status",
  "owner",
  "priority",
  "health",
  "due_date",
  "next_action_due_at",
] as const;

export const ENGAGEMENT_GROUP_FIELDS = ["none", "status", "owner", "priority", "health"] as const;
export const ENGAGEMENT_PAGE_SIZES = [25, 50, 100] as const;
export const ENGAGEMENT_DENSITIES = ["comfortable", "compact"] as const;

export type EngagementSortField = (typeof ENGAGEMENT_SORT_FIELDS)[number];
export type EngagementGroupField = (typeof ENGAGEMENT_GROUP_FIELDS)[number];
export type EngagementPageSize = (typeof ENGAGEMENT_PAGE_SIZES)[number];
export type EngagementDensity = (typeof ENGAGEMENT_DENSITIES)[number];
export type SortDirection = "asc" | "desc";

export type EngagementBoardQuery = {
  sort: EngagementSortField;
  direction: SortDirection;
  group: EngagementGroupField;
  page: number;
  pageSize: EngagementPageSize;
  limit: number;
  offset: number;
};

function includes<T extends string | number>(values: readonly T[], value: unknown): value is T {
  return values.includes(value as T);
}

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseEngagementBoardQuery(searchParams: URLSearchParams): EngagementBoardQuery {
  const requestedSort = searchParams.get("sort");
  const requestedDirection = searchParams.get("direction");
  const requestedGroup = searchParams.get("group");
  const hasBoardPagination = searchParams.has("page_size") || searchParams.has("page");
  const requestedPageSize = positiveInteger(searchParams.get("page_size"), 25);
  const pageSize = includes(ENGAGEMENT_PAGE_SIZES, requestedPageSize) ? requestedPageSize : 25;
  const page = positiveInteger(searchParams.get("page"), 1);
  const legacyLimit = Math.min(positiveInteger(searchParams.get("limit"), 100), 250);
  const legacyOffset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const limit = hasBoardPagination ? pageSize : legacyLimit;

  return {
    sort: includes(ENGAGEMENT_SORT_FIELDS, requestedSort) ? requestedSort : "updated_at",
    direction: requestedDirection === "asc" ? "asc" : "desc",
    group: includes(ENGAGEMENT_GROUP_FIELDS, requestedGroup) ? requestedGroup : "none",
    page,
    pageSize,
    limit,
    offset: hasBoardPagination ? (page - 1) * pageSize : legacyOffset,
  };
}

export function isEngagementDensity(value: unknown): value is EngagementDensity {
  return includes(ENGAGEMENT_DENSITIES, value);
}

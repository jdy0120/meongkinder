import type {
  NormalizedPagination,
  PaginatedData,
  PaginationMeta,
  PaginationQuery,
  SortOrder,
} from "../types/pagination";

/** 페이지네이션 기본값 (api·web 공통) */
export const PAGINATION_DEFAULTS = {
  page: 1,
  pageSize: 20,
  maxPageSize: 100,
  order: "desc" as SortOrder,
} as const;

const toInt = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * 클라이언트 쿼리를 기본값·허용범위로 보정한다.
 * (음수 page, 과도한 pageSize, 잘못된 order 값 방어)
 */
export function normalizePagination(
  query: PaginationQuery = {},
): NormalizedPagination {
  const page = Math.max(1, toInt(query.page, PAGINATION_DEFAULTS.page));
  const pageSize = clamp(
    toInt(query.pageSize, PAGINATION_DEFAULTS.pageSize),
    1,
    PAGINATION_DEFAULTS.maxPageSize,
  );
  const order: SortOrder =
    query.order === "asc" || query.order === "desc"
      ? query.order
      : PAGINATION_DEFAULTS.order;

  const sort = query.sort?.trim() || undefined;
  const search = query.search?.trim() || undefined;

  return { page, pageSize, sort, order, search };
}

/** 오프셋 기반 skip/take 계산 (Prisma·TypeORM·SQL 공통) */
export function toSkipTake(input: {
  page: number;
  pageSize: number;
}): { skip: number; take: number } {
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  };
}

/** total 을 받아 응답 메타를 만든다 */
export function buildPaginationMeta(input: {
  page: number;
  pageSize: number;
  total: number;
}): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(input.total / input.pageSize));
  return {
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
    totalPages,
    hasNext: input.page < totalPages,
    hasPrev: input.page > 1,
  };
}

/** items + total 로 목록 응답 본문을 조립한다 */
export function buildPaginatedData<T>(
  items: T[],
  input: { page: number; pageSize: number; total: number },
): PaginatedData<T> {
  return { items, meta: buildPaginationMeta(input) };
}

/**
 * 서버 서비스에서 쓰기 좋은 원스톱 헬퍼.
 * 쿼리를 보정하고 skip/take 까지 계산해서 돌려준다.
 */
export function resolvePagination(query: PaginationQuery = {}) {
  const normalized = normalizePagination(query);
  const { skip, take } = toSkipTake(normalized);
  return { ...normalized, skip, take };
}

/**
 * 클라이언트(web)에서 쿼리스트링을 만들 때 사용.
 * undefined/빈 값은 제외한 문자열 맵을 반환한다.
 */
export function toQueryParams(query: PaginationQuery = {}): Record<string, string> {
  const params: Record<string, string> = {};
  const normalized = normalizePagination(query);

  params.page = String(normalized.page);
  params.pageSize = String(normalized.pageSize);
  params.order = normalized.order;
  if (normalized.sort) params.sort = normalized.sort;
  if (normalized.search) params.search = normalized.search;

  return params;
}

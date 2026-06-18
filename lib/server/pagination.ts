import "server-only";

export function paginationFromUrl(url: string, defaultPageSize = 25) {
  const params = new URL(url).searchParams;
  const pageSize = Math.min(100, Math.max(5, Number(params.get("page_size") ?? defaultPageSize) || defaultPageSize));
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function paginationPayload(page: number, pageSize: number, count: number | null | undefined) {
  const total = count ?? 0;
  return {
    page,
    page_size: pageSize,
    total,
    has_more: page * pageSize < total,
  };
}

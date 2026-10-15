type SearchParamValue = string | string[] | undefined;

/** Invalid or missing values fall back to 1. */
export function parsePageParam(value: SearchParamValue): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);

  return Number.isInteger(page) && page >= 1 ? page : 1;
}

import { sql, type AnyColumn, type SQL } from "drizzle-orm";

export interface SearchOptions {
  query?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export function normalizeSearchQuery(searchQuery: string): string | null {
  const tsquery = searchQuery
    .trim()
    .split(/\s+/)
    .map(word => word.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(word => word.length > 0)
    .join(" & ");

  return tsquery || null;
}

export function buildDateRangeConditions(
  publishedAtColumn: AnyColumn,
  options: { startDate?: Date | undefined; endDate?: Date | undefined }
): SQL[] {
  const conditions: SQL[] = [];

  if (options.startDate) {
    conditions.push(sql`${publishedAtColumn} >= ${options.startDate}`);
  }
  if (options.endDate) {
    conditions.push(sql`${publishedAtColumn} <= ${options.endDate}`);
  }

  return conditions;
}

export function buildFullTextSearchCondition(
  searchVectorColumn: AnyColumn,
  tsquery: string
): SQL {
  return sql`${searchVectorColumn} @@ to_tsquery('english', ${tsquery})`;
}

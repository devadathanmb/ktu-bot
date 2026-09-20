/**
 * Preserve a primary failure together with additional failures such as cleanup
 * errors. A single failure is returned untouched so callers keep their existing
 * error handling, while multiple failures become an AggregateError ordered
 * `[primary, ...additional]` with the primary failure as its cause.
 */
export function combineFailures(
  message: string,
  primary: unknown,
  additional: readonly unknown[] = []
): unknown {
  if (additional.length === 0) {
    return primary;
  }

  return new AggregateError([primary, ...additional], message, {
    cause: primary,
  });
}

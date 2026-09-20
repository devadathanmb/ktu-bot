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

/**
 * Split an error produced by `combineFailures` back into its primary failure
 * and its additional failures. Any other error is a lone primary failure.
 */
export function splitCombinedFailure(error: unknown): {
  primary: unknown;
  additional: unknown[];
} {
  if (!(error instanceof AggregateError) || error.cause === undefined) {
    return { primary: error, additional: [] };
  }

  const additional: unknown[] = error.errors.filter(
    failure => failure !== error.cause
  );

  return { primary: error.cause, additional };
}

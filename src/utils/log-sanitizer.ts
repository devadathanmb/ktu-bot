import pino from "pino";

export const REDACTED = "[REDACTED]";

export type LogArguments = [
  obj: unknown,
  msg?: string | undefined,
  ...args: unknown[],
];

const MAX_LOG_DEPTH = 4;
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passwd",
  "pwd",
  "token",
  "access_token",
  "refresh_token",
  "x-token",
  "apikey",
  "api_key",
  "api-key",
  "secret",
  "client_secret",
  "private_key",
  "privatekey",
  "cert",
  "certificate",
  "ca",
]);

const SENSITIVE_KEY_PARTS = [
  "token",
  "secret",
  "password",
  "apikey",
  "api_key",
  "api-key",
  "privatekey",
] as const;

export const LOG_REDACT_PATHS = [
  "password",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "secret",
  "cert",
  "certificate",
  "ca",
  "*.password",
  "*.token",
  "*.apiKey",
  "*.api_key",
  "*.authorization",
  "*.cookie",
  "*.secret",
  "*.cert",
  "*.certificate",
  "*.ca",
  "*.headers.authorization",
  "*.headers.cookie",
  "*.options.body",
  "*.options.headers.authorization",
  "*.options.headers.cookie",
  "err.options.body",
  "err.options.headers.authorization",
  "err.options.headers.cookie",
  "error.options.body",
  "error.options.headers.authorization",
  "error.options.headers.cookie",
];

const ERROR_FIELD_ALLOWLIST = [
  "type",
  "name",
  "message",
  "stack",
  "code",
  "errno",
  "syscall",
  "status",
  "statusCode",
  "method",
  "url",
] as const;

const SENSITIVE_STRING_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, REDACTED],
  [/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`],
  [/\bBasic\s+[^\s,;]+/gi, `Basic ${REDACTED}`],
  [/\bbot\d+:[\w-]+/gi, REDACTED],
  [/(:\/\/[^:\s/@]+:)([^\s/@]+)(@)/g, `$1${REDACTED}$3`],
  [
    /\b([\w.-]*(?:token|api[_-]?key|secret|password|authorization)[\w.-]*\s*[:=]\s*)(?:Bearer|Basic)?\s*([^\s&,;]+)/gi,
    `$1${REDACTED}`,
  ],
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return (
    SENSITIVE_KEYS.has(normalizedKey) ||
    SENSITIVE_KEY_PARTS.some(part => normalizedKey.includes(part))
  );
}

function sanitizeString(value: string): string {
  return SENSITIVE_STRING_PATTERNS.reduce(
    (sanitizedValue, [pattern, replacement]) =>
      sanitizedValue.replace(pattern, replacement),
    value
  );
}

function getErrorField(error: Error, field: string): unknown {
  return isRecord(error) ? error[field] : undefined;
}

function sanitizeError(
  error: Error,
  seen: WeakSet<object>,
  depth: number
): unknown {
  const standardError = pino.stdSerializers.err(error) as Record<
    string,
    unknown
  >;
  const safeError: Record<string, unknown> = {};

  for (const field of ERROR_FIELD_ALLOWLIST) {
    const value = standardError[field] ?? getErrorField(error, field);

    if (value !== undefined) {
      safeError[field] = value;
    }
  }

  return sanitizeLogValue(safeError, seen, depth + 1);
}

export function sanitizeLogValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0
): unknown {
  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (value instanceof Error) {
    return sanitizeError(value, seen, depth);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof URL) {
    return sanitizeString(value.toString());
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_LOG_DEPTH) {
      return "[Array]";
    }

    return value.map(item => sanitizeLogValue(item, seen, depth + 1));
  }

  if (!isRecord(value)) {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (depth >= MAX_LOG_DEPTH) {
    return "[Object]";
  }

  seen.add(value);

  const sanitizedValue = Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      isSensitiveKey(key)
        ? REDACTED
        : sanitizeLogValue(nestedValue, seen, depth + 1),
    ])
  );

  seen.delete(value);

  return sanitizedValue;
}

export function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return sanitizeError(error, new WeakSet<object>(), 0);
  }

  return sanitizeLogValue(error);
}

export function sanitizeLogArguments(inputArgs: LogArguments): LogArguments {
  const [firstArgument, message, ...formatArguments] = inputArgs;

  if (inputArgs.length === 1) {
    return [sanitizeLogValue(firstArgument)];
  }

  return [
    sanitizeLogValue(firstArgument),
    message === undefined ? undefined : sanitizeString(message),
    ...formatArguments.map(argument => sanitizeLogValue(argument)),
  ];
}

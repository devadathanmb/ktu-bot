import assert from "node:assert/strict";
import test from "node:test";
import {
  REDACTED,
  sanitizeLogArguments,
  sanitizeLogValue,
  serializeError,
} from "../../src/utils/log-sanitizer.js";

test("sensitive keys are redacted regardless of nesting or case", () => {
  const sanitized = sanitizeLogValue({
    password: "hunter2",
    nested: { Authorization: "Bearer abc", harmless: "keep" },
    list: [{ api_key: "key-1" }],
  }) as Record<string, unknown>;

  assert.equal(sanitized["password"], REDACTED);
  assert.equal(
    (sanitized["nested"] as Record<string, unknown>)["Authorization"],
    REDACTED
  );
  assert.equal(
    (sanitized["nested"] as Record<string, unknown>)["harmless"],
    "keep"
  );
  assert.equal(
    ((sanitized["list"] as unknown[])[0] as Record<string, unknown>)["api_key"],
    REDACTED
  );
});

test("partial key matches redact token-like fields", () => {
  const sanitized = sanitizeLogValue({
    botToken: "secret",
    my_secret_value: "secret",
    tokenCount: 3,
  }) as Record<string, unknown>;

  assert.equal(sanitized["botToken"], REDACTED);
  assert.equal(sanitized["my_secret_value"], REDACTED);
  assert.equal(sanitized["tokenCount"], REDACTED);
});

test("credential-shaped strings are redacted in free text", () => {
  const cases: Array<[input: string, secret: string]> = [
    ["Authorization: Bearer abc123", "abc123"],
    ["postgres://user:s3cret@host/db", "s3cret"],
    ["api_key=live-123", "live-123"],
    [
      "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      "PRIVATE KEY-----\nabc",
    ],
  ];

  for (const [input, secret] of cases) {
    const sanitized = sanitizeLogValue(input) as string;
    assert.ok(!sanitized.includes(secret), `leaks secret: ${input}`);
    assert.ok(sanitized.includes(REDACTED), `nothing redacted: ${input}`);
  }
});

test("plain text without secrets passes through", () => {
  assert.equal(
    sanitizeLogValue("Processing attachment delivery job"),
    "Processing attachment delivery job"
  );
});

test("errors serialize through an allowlist without sensitive extras", () => {
  const error = Object.assign(new Error("boom"), {
    statusCode: 500,
    token: "should-not-leak",
    password: "should-not-leak",
  });

  const serialized = serializeError(error) as Record<string, unknown>;

  assert.equal(serialized["message"], "boom");
  assert.equal(serialized["statusCode"], 500);
  assert.equal("token" in serialized, false);
  assert.equal("password" in serialized, false);
  assert.equal("cause" in serialized, false);
});

test("circular structures and deep nesting are capped", () => {
  const circular: Record<string, unknown> = { name: "x" };
  circular["self"] = circular;
  const sanitized = sanitizeLogValue({ ref: circular }) as Record<
    string,
    unknown
  >;
  assert.equal(
    (sanitized["ref"] as Record<string, unknown>)["self"],
    "[Circular]"
  );

  const deep = { a: { b: { c: { d: { e: "too-deep" } } } } };
  const capped = JSON.stringify(sanitizeLogValue(deep));
  assert.ok(capped.includes("[Object]"), "deep nesting is capped");
  assert.ok(!capped.includes("too-deep"), "capped content is dropped");

  let nested: unknown = "x";
  for (let depth = 0; depth < 20; depth += 1) nested = [nested];
  assert.ok(
    JSON.stringify(sanitizeLogValue(nested)).includes("[Array]"),
    "deep arrays terminate with a cap marker"
  );
});

test("dates and URLs normalize to safe strings", () => {
  assert.equal(
    sanitizeLogValue(new Date("2026-01-01T00:00:00Z")),
    "2026-01-01T00:00:00.000Z"
  );
  assert.equal(
    sanitizeLogValue(new URL("https://user:s3cret@host/path")),
    `https://user:${REDACTED}@host/path`
  );
});

test("log arguments keep their shape with sanitized values", () => {
  assert.deepEqual(sanitizeLogArguments([{ token: "abc" }]), [
    { token: REDACTED },
  ]);

  const [obj, message, extra] = sanitizeLogArguments([
    { chatId: 7, password: "x" },
    "Bearer abc failed for user",
    { apiKey: "live" },
  ]);
  assert.deepEqual(obj, { chatId: 7, password: REDACTED });
  assert.match(message as string, /Bearer \[REDACTED\]/);
  assert.deepEqual(extra, { apiKey: REDACTED });
});

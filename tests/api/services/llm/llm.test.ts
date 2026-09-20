import assert from "node:assert/strict";
import test from "node:test";
import { HTTPError, type PlainResponse } from "got";
import {
  LLMService,
  type GroqCompletionRequester,
} from "../../../../src/api/services/llm/llm.js";
import { AnnouncementFilter } from "../../../../src/constants/courses.js";

const ANNOUNCEMENT_CONTENT = JSON.stringify({
  subject: "Fee payment notice",
  message: "Pay the pending fees before the deadline",
});

function completionResponse(content: string) {
  return {
    choices: [
      {
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  };
}

function requesterReturning(content: string): GroqCompletionRequester {
  return async () => completionResponse(content);
}

function requesterThrowing(error: unknown): GroqCompletionRequester {
  return async () => {
    throw error;
  };
}

function createRateLimitError(): HTTPError {
  const response = {
    statusCode: 429,
    statusMessage: "Too Many Requests",
    headers: { "retry-after": "5" },
  };
  const request = {
    // got's RequestError detects a request by this marker property.
    _onResponse: () => undefined,
    options: {
      method: "POST",
      url: new URL("https://api.groq.com/openai/v1/chat/completions"),
    },
    response,
  };

  return new HTTPError({ ...response, request } as unknown as PlainResponse);
}

test("a valid is_relevant false still suppresses the audience", async () => {
  const classifier = new LLMService(
    requesterReturning('{"is_relevant": false}')
  );

  assert.equal(
    await classifier.isAnnouncementRelevant(ANNOUNCEMENT_CONTENT),
    false
  );
});

test("a valid is_relevant true is returned unchanged", async () => {
  const classifier = new LLMService(
    requesterReturning('{"is_relevant": true}')
  );

  assert.equal(
    await classifier.isAnnouncementRelevant(ANNOUNCEMENT_CONTENT),
    true
  );
});

test("HTTP 429 fails open instead of suppressing the announcement", async () => {
  const classifier = new LLMService(requesterThrowing(createRateLimitError()));

  assert.equal(
    await classifier.isAnnouncementRelevant(ANNOUNCEMENT_CONTENT),
    true
  );
});

test("API and transport failures fail open", async () => {
  const classifier = new LLMService(
    requesterThrowing(new Error("socket hang up"))
  );

  assert.equal(
    await classifier.isAnnouncementRelevant(ANNOUNCEMENT_CONTENT),
    true
  );
});

test("schema-invalid LLM responses fail open", async () => {
  const classifier = new LLMService(
    requesterReturning('{"is_relevant": "not-a-boolean"}')
  );

  assert.equal(
    await classifier.isAnnouncementRelevant(ANNOUNCEMENT_CONTENT),
    true
  );
});

test("invalid JSON LLM responses fail open", async () => {
  const classifier = new LLMService(requesterReturning("not json at all"));

  assert.equal(
    await classifier.isAnnouncementRelevant(ANNOUNCEMENT_CONTENT),
    true
  );
});

test("a failed course lookup returns an empty set to keep broad filters", async () => {
  const classifier = new LLMService(
    requesterThrowing(new Error("socket hang up"))
  );

  const courses =
    await classifier.findRelevantCoursesFromAnnouncement(ANNOUNCEMENT_CONTENT);

  assert.deepEqual([...courses], []);
});

test("valid course lookups are filtered to known course codes", async () => {
  const classifier = new LLMService(
    requesterReturning('{"relevant_courses": ["BTECH", "NOT_A_COURSE", "MCA"]}')
  );

  const courses =
    await classifier.findRelevantCoursesFromAnnouncement(ANNOUNCEMENT_CONTENT);

  assert.deepEqual([...courses].sort(), [
    AnnouncementFilter.BTECH,
    AnnouncementFilter.MCA,
  ]);
});

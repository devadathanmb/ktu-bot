import assert from "node:assert/strict";
import test from "node:test";
import {
  createViewAnotherKeyboard,
  getContextEmoji,
} from "../src/bot/utils/presentation.js";
import { callbackData } from "./helpers.js";

test("view-another keyboards keep button text and callback payloads", () => {
  for (const prefix of ["timetable", "announcement", "syllabus"]) {
    const keyboard = createViewAnotherKeyboard(prefix);
    assert.deepEqual(
      keyboard.inline_keyboard.flat().map(button => button.text),
      ["✅ Yes", "❌ No"]
    );
    assert.deepEqual(callbackData(keyboard), [
      `${prefix}_view_another_true`,
      `${prefix}_view_another_false`,
    ]);
  }
});

test("context emoji covers known lookup contexts with a paperclip fallback", () => {
  assert.deepEqual(
    [
      "calendar",
      "timetable",
      "announcement",
      "inline query result",
      "syllabus",
    ].map(getContextEmoji),
    ["📅", "📚", "📎", "📎", "📜"]
  );
  assert.equal(getContextEmoji("unknown-context"), "📎");
});

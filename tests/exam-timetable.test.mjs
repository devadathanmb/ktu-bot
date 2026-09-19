import assert from "node:assert/strict";
import test from "node:test";
import { getTimetableAttachment } from "../src/bot/composers/lookups/exam-timetable/attachments.ts";
import {
  generateTimetablesKeyboard,
  generateTimetablesText,
  formatTimetableDetails,
} from "../src/bot/composers/lookups/exam-timetable/views.ts";

const timetable = {
  id: 91,
  attachmentId: 7,
  title: "B.Tech <Revised> & Final",
  encryptId: "encrypted-id",
  fileName: "Exam timetable.pdf",
  publishedAt: null,
  formattedPublishedDate: "19 September 2026",
};

test("incomplete attachment metadata cannot produce a download attachment", () => {
  for (const attachmentId of [null, 0]) {
    assert.equal(getTimetableAttachment({ ...timetable, attachmentId }), null);
  }
  for (const field of ["fileName", "encryptId"]) {
    for (const value of [null, "", " \t\n"]) {
      assert.equal(
        getTimetableAttachment({ ...timetable, [field]: value }),
        null,
        `${field} must be a nonblank string`
      );
    }
  }
});

test("valid attachment strings are preserved verbatim", () => {
  assert.deepEqual(getTimetableAttachment(timetable), {
    name: "Exam timetable.pdf",
    encryptId: "encrypted-id",
  });
  assert.deepEqual(
    getTimetableAttachment({
      ...timetable,
      fileName: " Exam.pdf ",
      encryptId: " token== ",
    }),
    { name: " Exam.pdf ", encryptId: " token== " }
  );
});

test("API pages retain their items and IDs on later pages", () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    ...timetable,
    id: 91 + index,
    title: `Exam ${index}`,
  }));
  const keyboard = generateTimetablesKeyboard(items, 3);
  assert.deepEqual(
    keyboard.inline_keyboard.map(row => row.length),
    [5, 1, 3]
  );
  assert.deepEqual(
    keyboard.inline_keyboard.flat().map(button => button.callback_data),
    [
      ...[91, 92, 93, 94, 95, 96].map(id => `timetable_select_${id}`),
      "timetable_prev_page",
      "timetable_page_info",
      "timetable_next_page",
    ]
  );
  assert.equal(keyboard.inline_keyboard[2][1].text, "Page: 4");
  const text = generateTimetablesText(items);
  assert.match(text.text, /1\) Exam 0/);
  assert.match(text.text, /6\) Exam 5/);
  assert.match(text.text, /Published date: 19 September 2026/);
});

test("details preserve literal text and formatting entities", () => {
  const details = formatTimetableDetails(timetable);
  assert.equal(
    details.text,
    "🌟 Title:\nB.Tech <Revised> & Final\n\n📅 Date: 19 September 2026"
  );
  assert.deepEqual(
    details.entities
      .filter(entity => entity.type === "bold")
      .map(entity =>
        details.text.slice(entity.offset, entity.offset + entity.length)
      ),
    ["🌟 Title:", "📅 Date:"]
  );
});

test("details omit absent fields", () => {
  assert.equal(
    formatTimetableDetails({ ...timetable, title: "" }).text,
    "📅 Date: 19 September 2026"
  );
  assert.equal(
    formatTimetableDetails({ ...timetable, formattedPublishedDate: "" }).text,
    "🌟 Title:\nB.Tech <Revised> & Final"
  );
  assert.equal(
    formatTimetableDetails({
      ...timetable,
      title: "",
      formattedPublishedDate: "",
    }).text,
    ""
  );
});

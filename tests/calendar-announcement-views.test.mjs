import assert from "node:assert/strict";
import test from "node:test";
import {
  generateCalendarsKeyboard,
  generateCalendarsText,
  formatCalendarDetails,
} from "../src/bot/composers/lookups/academic-calendar/views.ts";
import {
  generateAnnouncementsKeyboard,
  generateAnnouncementsText,
  formatAnnouncementDetails,
} from "../src/bot/composers/lookups/announcements/views.ts";

const calendar = {
  id: 41,
  title: "Calendar <Revised> & Final",
  attachmentId: 3,
  encryptId: "id",
  attachmentName: "calendar.pdf",
  publishedAt: null,
  formattedPublishedDate: "20 September 2026",
};
const announcement = {
  id: 81,
  subject: "Exams <Revised> & Final",
  message: "Read <carefully> & prepare.",
  publishedAt: null,
  formattedPublishedDate: "20 September 2026",
  attachments: [],
};

for (const [label, fixture, keyboardBuilder, textBuilder, prefix] of [
  [
    "calendar",
    calendar,
    generateCalendarsKeyboard,
    generateCalendarsText,
    "calendar",
  ],
  [
    "announcement",
    announcement,
    generateAnnouncementsKeyboard,
    generateAnnouncementsText,
    "announcement",
  ],
]) {
  test(`${label} API pages retain all items, selection IDs and row layout`, () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      ...fixture,
      id: 101 + index,
    }));
    const keyboard = keyboardBuilder(items, 3);
    assert.deepEqual(
      keyboard.inline_keyboard.map(row => row.length),
      [5, 1, 3]
    );
    assert.deepEqual(
      keyboard.inline_keyboard.flat().map(button => button.callback_data),
      [
        ...[101, 102, 103, 104, 105, 106].map(id => `${prefix}_select_${id}`),
        `${prefix}_prev_page`,
        `${prefix}_page_info`,
        `${prefix}_next_page`,
      ]
    );
    assert.equal(keyboard.inline_keyboard[2][1].text, "Page: 4");
    const text = textBuilder(items);
    assert.ok(text.text.includes(`6) ${fixture.title ?? fixture.subject}`));
    assert.match(text.text, /Published date: 20 September 2026/);
    assert.ok(text.entities.some(entity => entity.type === "bold"));
  });
}

function boldText(message) {
  return message.entities
    .filter(entity => entity.type === "bold")
    .map(entity =>
      message.text.slice(entity.offset, entity.offset + entity.length)
    );
}

test("calendar details preserve inline labels and literal title", () => {
  const details = formatCalendarDetails(calendar);
  assert.equal(
    details.text,
    "🌟 Title: Calendar <Revised> & Final\n\n📅 Date: 20 September 2026"
  );
  assert.deepEqual(boldText(details), ["Title:", "Date:"]);
});

test("announcement details preserve separate sections and entities", () => {
  const details = formatAnnouncementDetails(announcement);
  assert.equal(
    details.text,
    "📖 Subject:\nExams <Revised> & Final\n\n📝 Message:\nRead <carefully> & prepare.\n\n📅 Date: 20 September 2026"
  );
  assert.deepEqual(boldText(details), [
    "📖 Subject:",
    "📝 Message:",
    "📅 Date:",
  ]);
});

test("announcement details omit empty sections", () => {
  assert.equal(
    formatAnnouncementDetails({ ...announcement, subject: "", message: "" })
      .text,
    "📅 Date: 20 September 2026"
  );
  assert.equal(
    formatAnnouncementDetails({
      ...announcement,
      subject: "",
      formattedPublishedDate: "",
    }).text,
    "📝 Message:\nRead <carefully> & prepare."
  );
  assert.equal(
    formatAnnouncementDetails({
      ...announcement,
      subject: "",
      message: "",
      formattedPublishedDate: "",
    }).text,
    ""
  );
});

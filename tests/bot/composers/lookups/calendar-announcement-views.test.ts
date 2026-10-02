import assert from "node:assert/strict";
import test from "node:test";
import type { FormattedString } from "@grammyjs/parse-mode";
import type { InlineKeyboard } from "grammy";
import {
  formatCalendarDetails,
  generateCalendarsKeyboard,
  generateCalendarsText,
} from "../../../../src/bot/composers/lookups/academic-calendar/views.js";
import {
  formatAnnouncementDetails,
  generateAnnouncementsKeyboard,
  generateAnnouncementsText,
} from "../../../../src/bot/composers/lookups/announcements/views.js";
import type {
  AcademicCalendar,
  Announcement,
} from "../../../../src/types/service.types.js";
import { callbackData } from "../../../helpers.js";
import { renderAnnouncementResults } from "../../../../src/bot/composers/inline-query/results.js";

const calendar: AcademicCalendar = {
  id: 41,
  title: "Calendar <Revised> & Final",
  attachmentId: 3,
  encryptId: "id",
  attachmentName: "calendar.pdf",
  publishedAt: null,
  formattedPublishedDate: "20 September 2026",
};
const announcement: Announcement = {
  id: 81,
  subject: "Exams <Revised> & Final",
  message: "Read <carefully> & prepare.",
  publishedAt: null,
  formattedPublishedDate: "20 September 2026",
  attachments: [],
};

interface LookupCase<Item> {
  label: string;
  fixture: Item;
  title: string;
  keyboardBuilder: (items: Item[], page: number) => InlineKeyboard;
  textBuilder: (items: Item[]) => FormattedString;
  prefix: string;
}

function runLookupCase<Item>(lookupCase: LookupCase<Item>): void {
  const { label, fixture, title, keyboardBuilder, textBuilder, prefix } =
    lookupCase;
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
    assert.deepEqual(callbackData(keyboard), [
      ...[101, 102, 103, 104, 105, 106].map(id => `${prefix}_select_${id}`),
      `${prefix}_prev_page`,
      `${prefix}_page_info`,
      `${prefix}_next_page`,
    ]);
    assert.equal(keyboard.inline_keyboard[2]?.[1]?.text, "Page: 4");
    const text = textBuilder(items);
    assert.ok(text.text.includes(`6) ${title}`));
    assert.match(text.text, /Published date: 20 September 2026/);
    assert.ok(text.entities.some(entity => entity.type === "bold"));
    assert.match(text.text, /below\.\n\n↔️ Use the arrows to browse pages\./);
    assert.ok(boldText(text).some(span => span.startsWith("Choose your ")));
  });
}

runLookupCase({
  label: "calendar",
  fixture: calendar,
  title: calendar.title,
  keyboardBuilder: generateCalendarsKeyboard,
  textBuilder: generateCalendarsText,
  prefix: "calendar",
});

runLookupCase({
  label: "announcement",
  fixture: announcement,
  title: announcement.subject,
  keyboardBuilder: generateAnnouncementsKeyboard,
  textBuilder: generateAnnouncementsText,
  prefix: "announcement",
});

function boldText(message: FormattedString): string[] {
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
    "📖 Title:\n\nExams <Revised> & Final\n\n📝 Message:\n\nRead <carefully> & prepare.\n\n📅 Published: 20 September 2026"
  );
  assert.deepEqual(boldText(details), [
    "📖 Title:",
    "📝 Message:",
    "📅 Published:",
  ]);
});

test("announcement details omit empty sections", () => {
  assert.equal(
    formatAnnouncementDetails({ ...announcement, subject: "", message: "" })
      .text,
    "📅 Published: 20 September 2026"
  );
  assert.equal(
    formatAnnouncementDetails({
      ...announcement,
      subject: "",
      formattedPublishedDate: "",
    }).text,
    "📝 Message:\n\nRead <carefully> & prepare."
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

test("inline and interactive announcements retain the same spacing, content and entities", () => {
  const item = {
    ...announcement,
    message: "First paragraph <&> 😀.\n\nSecond paragraph — kept.",
  };
  const details = formatAnnouncementDetails(item);
  const result = renderAnnouncementResults([item])[0]!;
  assert.ok(
    result.type === "article" && "message_text" in result.input_message_content
  );
  assert.equal(result.input_message_content.message_text, details.text);
  assert.deepEqual(result.input_message_content.entities, details.entities);
  assert.ok(details.text.includes(item.message));
});

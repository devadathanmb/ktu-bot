import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProgramsPage,
  buildSchemesPage,
  buildBranchesPage,
  buildSyllabusEntriesPage,
} from "../src/bot/composers/lookups/syllabus/views.ts";

function callbacks(keyboard) {
  return keyboard.inline_keyboard.flat().map(button => button.callback_data);
}

test("program pages keep API IDs, local numbering, and five buttons per row", () => {
  const programs = Array.from({ length: 11 }, (_, index) => ({
    id: 100 + index,
    name: `Program ${index}`,
    description: null,
  }));
  const first = buildProgramsPage(programs, 0);
  assert.deepEqual(
    first.keyboard.inline_keyboard.map(row => row.length),
    [5, 5, 3]
  );
  assert.equal(callbacks(first.keyboard)[0], "syllabusprog_select_100");
  const second = buildProgramsPage(programs, 1);
  assert.deepEqual(callbacks(second.keyboard), [
    "syllabusprog_select_110",
    "syllabusprog_prev_page",
    "syllabusprog_page_info",
    "syllabusprog_next_page",
  ]);
  assert.match(second.text.text, /1\) Program 10/);
  assert.doesNotMatch(second.text.text, /Program 9/);
  assert.equal(second.keyboard.inline_keyboard[1][1].text, "Page: 2");
  assert.ok(second.text.entities.some(entity => entity.type === "bold"));
});

test("scheme and branch pages preserve labels and curriculum IDs", () => {
  const scheme = buildSchemesPage(
    [
      {
        id: 42,
        scheme: "2024 Scheme",
        academicYear: "2024",
        programTypeName: "UG",
      },
    ],
    0
  );
  assert.equal(callbacks(scheme.keyboard)[0], "syllabusscheme_select_42");
  assert.match(scheme.text.text, /Academic year: 2024 · UG/);

  const branch = buildBranchesPage(
    [
      {
        id: 73,
        branchName: "Computer Science",
        schemeName: "2024",
        programTypeName: "UG",
        academicYear: "2024",
      },
    ],
    0
  );
  assert.equal(callbacks(branch.keyboard)[0], "syllabusbranch_select_73");
  assert.match(branch.text.text, /1\) Computer Science/);
  assert.match(branch.text.text, /Academic year: 2024/);
});

test("filtered syllabus pages retain original response indices across pages", () => {
  const entries = Array.from({ length: 24 }, (_, index) => ({
    attachmentId: index,
    encryptAttachmentId: index % 2 === 0 ? null : `encrypted-${index}`,
    attachmentName: `Syllabus ${index}.pdf`,
    description: `Description ${index}`,
  }));
  const first = buildSyllabusEntriesPage(entries, 0);
  assert.deepEqual(
    callbacks(first.keyboard).slice(0, 10),
    [1, 3, 5, 7, 9, 11, 13, 15, 17, 19].map(
      index => `syllabusentry_select_${index}`
    )
  );
  const second = buildSyllabusEntriesPage(entries, 1);
  assert.deepEqual(callbacks(second.keyboard), [
    "syllabusentry_select_21",
    "syllabusentry_select_23",
    "syllabusentry_prev_page",
    "syllabusentry_page_info",
    "syllabusentry_next_page",
  ]);
  assert.match(second.text.text, /1\) Syllabus 21.pdf/);
  assert.match(second.text.text, /2\) Syllabus 23.pdf/);
  assert.doesNotMatch(second.text.text, /Syllabus 19.pdf/);
});

test("eligibility checks null fields without discarding empty strings", () => {
  const entries = [
    {
      attachmentId: null,
      encryptAttachmentId: "id",
      attachmentName: null,
      description: null,
    },
    {
      attachmentId: null,
      encryptAttachmentId: null,
      attachmentName: "file.pdf",
      description: null,
    },
    {
      attachmentId: null,
      encryptAttachmentId: "",
      attachmentName: "",
      description: null,
    },
  ];
  assert.equal(
    callbacks(buildSyllabusEntriesPage(entries, 0).keyboard)[0],
    "syllabusentry_select_2"
  );
  assert.deepEqual(callbacks(buildSyllabusEntriesPage([], 0).keyboard), [
    "syllabusentry_prev_page",
    "syllabusentry_page_info",
    "syllabusentry_next_page",
  ]);
});

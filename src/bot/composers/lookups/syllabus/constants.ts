// Callback prefixes — no underscores in the prefix itself so parseSelectCallback works
export const CB = {
  PROGRAM: "syllabusprog",
  SCHEME: "syllabusscheme",
  BRANCH: "syllabusbranch",
  SYLLABUS: "syllabusentry",
  VIEW_ANOTHER: "syllabus",
} as const;

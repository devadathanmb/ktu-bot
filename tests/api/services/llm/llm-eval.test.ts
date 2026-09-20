import assert from "node:assert/strict";
import test from "node:test";
import { LLMService } from "../../../../src/api/services/llm/llm.js";

// Live-model evals against the Groq API. These stay skipped in the default
// suite (no network, no key needed) and only run on demand:
//
//   set -a; . ./.env; pnpm test:llm-eval
//
const RUN_LIVE = process.env.RUN_LLM_EVAL === "1";
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const HAS_REAL_KEY = GROQ_API_KEY !== "" && GROQ_API_KEY !== "test-groq-key";

function requireRealKey(): void {
  assert.ok(
    HAS_REAL_KEY,
    "RUN_LLM_EVAL=1 needs a real GROQ_API_KEY (tests/setup.ts only provides a dummy)"
  );
}

interface RelevanceCase {
  name: string;
  subject: string;
  message: string;
  expected: boolean;
}

const RELEVANCE_CASES: RelevanceCase[] = [
  {
    name: "exam postponement is relevant",
    subject:
      "Examinations postponed- Proposed nation wide strike & holidays coming immediately after the Christmas Vacation - Re-scheduled - Reg",
    message: "",
    expected: true,
  },
  {
    name: "fellowship session is not relevant",
    subject: "Online Interactive Session on Fulbright Fellowships",
    message: "",
    expected: false,
  },
  {
    // announcements.id = 5459
    name: "published B.Tech results are relevant",
    subject:
      "KTU - Examination (UG-Valuation) - Publication of Results - B.Tech S3 (Special Exam) Jan 2026 (2015 Scheme)",
    message:
      "It is hereby notified that the results of B.Tech S3 (Special Exam) Jan 2026 (2015 Scheme) are published. The detailed results are available in Student and College login.",
    expected: true,
  },
  {
    // announcements.id = 5458
    name: "B.Tech timetable publication is relevant",
    subject:
      "KTU - Detailed Time Table of B.Tech S8 (S, FE) September 2026 (2019 Scheme), including B.Tech S8 (PT) (S, FE) September 2026 (2019 Scheme) & B.Tech S8 (WP) (S) September 2026 examinations",
    message:
      "The detailed timetable of B.Tech S8 (S, FE) Exam September 2026 (2019 Scheme), including B.Tech S8 (PT) (S, FE) Exam September 2026 (2019 Scheme) & B.Tech S8 (WP) (S) Exam September 2026, is published herewith.",
    expected: true,
  },
  {
    // announcements.id = 5425
    name: "staff appointment notice is not relevant",
    subject:
      "Extension of the last date for receipt of applications to various statutory and administrative positions up to  17.09.2026",
    message:
      "It is hereby notified that the last date for receipt of applications invited vide the notification read as (1) above for appointment to the posts of Registrar, Controller of Examinations, Dean (Academic), Dean (Research), Director, Joint Director, Joint Director (Student Affairs), and Assistant Director, which was earlier extended up to 07.09.2026, is hereby further extended up to 17.09.2026.",
    expected: false,
  },
  {
    // announcements.id = 5049
    name: "doctoral fellowship call is not relevant",
    subject: "AICTE Doctoral Fellowship (ADF) 2025-26",
    message:
      "APJ Abdul Kalam Technological University, Kerala, invites applications from eligible candidates for the AICTE Doctoral Fellowship (ADF) 2025-26",
    expected: false,
  },
];

interface CourseCase {
  name: string;
  subject: string;
  message: string;
  expected: string[];
}

const COURSE_CASES: CourseCase[] = [
  {
    name: "M Arch / M.Plan announcement maps to MARCH and MPLAN",
    subject:
      "APJAKTU - Examination (PG-Valuation) - Supplementary Exam registration to M Arch S3/ M.Plan S3 Examinations Dec 2025",
    message:
      "Supplementary Exam Registrations to the following Examinations Dec 2025 are opened for Supplementary Students/ Colleges",
    expected: ["MARCH", "MPLAN"],
  },
  {
    name: "announcement with no course mention maps to nothing",
    subject: "University closed on Monday",
    message: "All offices remain closed on account of the public holiday",
    expected: [],
  },
  {
    // announcements.id = 5429
    name: "course duration extension maps to BTECH, BDES, HMCT and BARCH",
    subject:
      "Extension of Course Duration – B.Tech (2019 Scheme), B.Des (2019 Scheme), B.HMCT (2018 Scheme) and B.Arch (2016) Programmes",
    message:
      "It is hereby notified that the portal for submission of Course Duration Extension Requests has been opened for the following batches: B.Tech: 2019–2020 and 2020–2021 batches. B.Des: 2019–2020 and 2020–2021 batches. B.HMCT: 2018–2019, 2019–2020 and 2020–2021 batches. B.Arch: 2016–2017, 2017–2018, 2018–2019, 2019–2020 and 2020–2021 batches.",
    expected: ["BARCH", "BDES", "BTECH", "HMCT"],
  },
  {
    // announcements.id = 5420
    name: "first-semester commencement maps to MBA, MCA, MARCH and MPLAN",
    subject:
      "Commencement of First Semester classes for the MBA, Integrated MBA, MCA, Integrated MCA, M.Arch, and M.Plan programmes for the Academic Year 2026–27",
    message: "",
    expected: ["MARCH", "MBA", "MCA", "MPLAN"],
  },
  {
    // announcements.id = 5422
    name: "MBA result maps to MBA only",
    subject:
      "KTU - Examination (PG-Valuation) - Publication of Result - MBA S2 (R,S) Examination April 2026",
    message:
      "It is hereby notified that the result of MBA S2(R,S) Examination April 2026 is published herewith. The detailed results are available under the 'Result' tab of the University website and in the Student/College login.",
    expected: ["MBA"],
  },
  {
    // announcements.id = 5060
    name: "generic UG calendar maps to nothing",
    subject:
      "APJAKTU - Examination - UG programmes - Examination Calendar April 2026 to June 2026- Regular/Supplementary end semester Examinations",
    message:
      "The Examination Calendar, which provides the slot-wise dates of end-semester examinations for UG programmes from April 2026 to June 2026, is notified herewith.",
    expected: [],
  },
];

// Mixed expectations are deliberate: the service falls back to `true`
// (relevance) and empty sets (courses) on API errors, so a dead API fails
// the `false` / non-empty cases and the run goes red instead of green.
for (const { name, subject, message, expected } of RELEVANCE_CASES) {
  test(`llm eval: ${name}`, { skip: !RUN_LIVE, timeout: 180_000 }, async () => {
    requireRealKey();
    const service = new LLMService();
    const relevant = await service.isAnnouncementRelevant(
      JSON.stringify({ subject, message })
    );
    assert.equal(relevant, expected);
  });
}

for (const { name, subject, message, expected } of COURSE_CASES) {
  test(`llm eval: ${name}`, { skip: !RUN_LIVE, timeout: 180_000 }, async () => {
    requireRealKey();
    const service = new LLMService();
    const courses = await service.findRelevantCoursesFromAnnouncement(
      JSON.stringify({ subject, message })
    );
    assert.deepEqual([...courses].sort(), expected);
  });
}

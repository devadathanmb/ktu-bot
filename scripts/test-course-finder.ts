import { LLMService } from "../src/api/services/llm/llm.js";
import { COURSES } from "../src/constants/courses.js";
import logger from "../src/utils/logger.js";

const testAnnouncements = [
  {
    subject: "Revised Syllabus of Economics for Engineers (UCHUT346)",
    message:
      "The revised syllabus of Economics for Engineers (UCHUT346) is available on the University website and may be accessed through the following path:\nAcademics → Regulation and Syllabus → B.Tech Full Time 2024 Scheme → Syllabus → Semester 3 to Semester 8 Branch-wise Syllabus → View Syllabus → Common Courses",
  },
  {
    subject:
      "APJAKTU - Examination (UG-Valuation) - Publication of Results - BBA Honours S1(S) Exam May 2025",
    message:
      "It is hereby notified that the results of BBA Honours S1(S) Exam May 2025 are published. The detailed results are available in Student and College login",
  },
  {
    subject:
      "Revised Examination -PG programmes - Special Examinations August/September 2025 - Supplementary/ Part-time - Examination Calendar",
    message:
      "The Revised Examination Calendar furnishing the slot-wise dates of Special Examinations for various PG programmes(Oldscheme) during August /September 2025 is notified herewith.",
  },
  {
    subject:
      "APJAKTU - Examination (PG-Valuation) - Supplementary Exam registration to M Arch S3/ M.Plan S3 Examinations Dec 2025",
    message:
      "It is hereby informed that Supplementary Exam Registrations to the following Examinations Dec 2025 are opened for Supplementary Students/ Colleges, as scheduled below",
  },
  {
    subject:
      "APJAKTU - Examination(UG-Valuation) - Exam registration for B.Arch S1 to S9 Exams ( FE and Supplementary) Nov/Dec 2025 (2016 Scheme)",
    message: "",
  },
  {
    subject:
      "APJAKTU - Examination(UG-Valuation) - Exam registration for BHMCT S1/S2/S3/S4/S6 (FE & Supplementary) Exams Dec 2025/Jan 2026 (2018 Scheme)",
    message:
      "It is hereby informed that Exam Registrations for BHMCT S1/S2/S3/S4/S6 Exams Dec 2025/Jan 2026 (2018 Scheme) are opened for FE & Supplementary Students/ Colleges, as scheduled below",
  },
];

async function testCourseFinder() {
  const llmService = new LLMService();

  logger.info("Starting course finder tests");

  for (const announcement of testAnnouncements) {
    const announcementJson = JSON.stringify(announcement);

    try {
      const relevantCourses =
        await llmService.findRelevantCoursesFromAnnouncement(announcementJson);

      logger.info(
        {
          subject: announcement.subject,
          courses: Array.from(relevantCourses),
        },
        "Course finding result"
      );
    } catch (error) {
      logger.error(
        {
          error,
          subject: announcement.subject,
        },
        "Course finding failed"
      );
    }
  }

  logger.info("Course finder tests completed");
}

testCourseFinder().catch(error => logger.error(error, "Test script failed"));

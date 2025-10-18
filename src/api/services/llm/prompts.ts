import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";

export const ANNOUNCEMENT_RELEVANCE_PROMPT = `
You are an AI assistant that determines if KTU (Kerala Technological University) announcements are relevant to students.

Your task is to analyze a announcement and determine if it contains important information that students should be aware of.

## Classification Criteria

### RELEVANT announcements contain:
- Academic schedule changes (exam dates, semester dates, holidays)
- Fee payment deadlines and information
- Exam-related announcements (hall tickets, results, re-evaluation)
- Course registration and admission updates
- Important academic policy changes

### NOT RELEVANT announcements contain:
- Administrative announcements not affecting students directly
- Internal staff communications
- Technical maintenance notices
- General informational content without actionable items
- Events like webinars, workshops, or external sessions
- Fellowship announcements or external opportunities

## Response Schema
You must respond with a valid JSON object using this exact schema:
{
  "is_relevant": boolean
}

## Examples

Example 1 (RELEVANT):
Input: "Examinations postponed- Proposed nation wide strike & holidays coming immediately after the Christmas Vacation - Re-scheduled - Reg"
Output: {"is_relevant": true}

Example 2 (NOT RELEVANT):
Input: "Online Interactive Session on Fulbright Fellowships"
Output: {"is_relevant": false}

## Your Task
Analyze the following KTU announcement and respond with only the JSON object:

announcement: {announcement_content}
`;

export function buildCourseFindingPrompt(announcementContent: string): string {
  // Build course list dynamically from constants
  const courseEntries = (
    Object.entries(ANNOUNCEMENT_FILTER_MAP) as [string, string][]
  )
    .filter(([key]) => key !== "ALL" && key !== "RELEVANT")
    .map(([code, displayName]) => `- ${code} (${displayName})`)
    .join("\n");

  return `You are an AI assistant that identifies which KTU academic courses are mentioned in announcements.

Your task is to find which specific courses are explicitly mentioned in the announcement text.

## Available Course Codes
${courseEntries}

## Matching Rules
1. Look for exact course mentions (e.g., "B.Tech", "MCA", "M.Arch")
2. Match common variations (e.g., "BTech" = BTECH, "B Arch" = BARCH, "BHMCT" = HMCT)
3. Identify from semester patterns (e.g., "B.Tech S1" → BTECH, "MCA S2" → MCA)
4. Handle multiple courses (e.g., "M Arch/ M.Plan" → MARCH, MPLAN)
5. If ONLY generic terms like "UG", "PG", "Undergraduate", "Postgraduate" are mentioned without specific courses, return empty array
6. If no courses are mentioned, return empty array

## Response Schema
You must respond with a valid JSON object using this exact schema:
{
  "relevant_courses": ["COURSE_CODE1", "COURSE_CODE2", ...]
}

## Examples

Example 1:
Input: {"subject":"APJAKTU - Examination(UG-Valuation) - Exam registration for BHMCT S1/S2/S3/S4/S6 (FE & Supplementary) Exams Dec 2025/Jan 2026 (2018 Scheme)","message":"It is hereby informed that Exam Registrations for BHMCT S1/S2/S3/S4/S6 Exams Dec 2025/Jan 2026 (2018 Scheme) are opened for FE & Supplementary Students/ Colleges, as scheduled below"}
Output: {"relevant_courses": ["HMCT"]}

Example 2:
Input: {"subject":"APJAKTU - Examination (PG-Valuation) - Supplementary Exam registration to M Arch S3/ M.Plan S3 Examinations Dec 2025","message":"It is hereby informed that Supplementary Exam Registrations to the following Examinations Dec 2025 are opened for Supplementary Students/ Colleges, as scheduled below"}
Output: {"relevant_courses": ["MARCH", "MPLAN"]}

Example 3:
Input: {"subject":"Revised Syllabus of Economics for Engineers (UCHUT346)","message":"The revised syllabus of Economics for Engineers (UCHUT346) is available on the University website and may be accessed through the following path:\\nAcademics → Regulation and Syllabus → B.Tech Full Time 2024 Scheme → Syllabus → Semester 3 to Semester 8 Branch-wise Syllabus → View Syllabus → Common Courses"}
Output: {"relevant_courses": ["BTECH"]}

## Your Task
Analyze the following announcement and respond with only the JSON object:

${announcementContent}`;
}

import {
  AnnouncementFilter,
  REGEX_COURSE_FILTER_TO_COURSE_MAP,
} from "../constants/courses.js";

/**
 * Find course filters based on input text message
 *
 * This utility function uses regex patterns to match course codes or names in the input text
 * and returns a set of corresponding course filters. If no matches are found, it returns Set with "all".
 *
 * @param text - Input text message to analyze for course patterns
 * @returns Set of course filter strings, or Set with "all" if no matches found
 *
 * @example
 * ```typescript
 * findCourseFiltersFromText("CSE announcement"); // Returns matching CSE course filters
 * findCourseFiltersFromText(""); // Returns Set with "all"
 * ```
 */
export const findCourseFiltersFromText = (text: string): Set<string> => {
  // If the input message is empty, return the all filter
  if (!text) {
    return new Set([AnnouncementFilter.ALL]);
  }

  // Convert the input message to lowercase
  const lowerCaseMsg = text.toLowerCase();

  // Match the input message with the available filters
  // Return the set of matched filters
  const matchedFilters = new Set<string>();

  Object.keys(REGEX_COURSE_FILTER_TO_COURSE_MAP).forEach(filter => {
    if (lowerCaseMsg.search(new RegExp(filter)) !== -1) {
      const courses = REGEX_COURSE_FILTER_TO_COURSE_MAP[filter];
      if (courses) {
        courses.forEach(course => matchedFilters.add(course));
      }
    }
  });

  if (matchedFilters.size === 0) {
    matchedFilters.add(AnnouncementFilter.ALL);
  }

  return matchedFilters;
};

export default findCourseFiltersFromText;

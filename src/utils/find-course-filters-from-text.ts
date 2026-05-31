import {
  AnnouncementFilter,
  REGEX_COURSE_FILTER_TO_COURSE_MAP,
} from "../constants/courses.js";

const findCourseFiltersFromText = (text: string): Set<AnnouncementFilter> => {
  if (!text) {
    return new Set([AnnouncementFilter.ALL]);
  }

  const lowerCaseMsg = text.toLowerCase();

  const matchedFilters = new Set<AnnouncementFilter>();

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

import {
  AnnouncementFilter,
  POSTGRADUATE_COURSES,
  UNDERGRADUATE_COURSES,
} from "../../../constants/courses.js";

function containsEveryFilter(
  filters: ReadonlySet<AnnouncementFilter>,
  requiredFilters: ReadonlySet<AnnouncementFilter>
): boolean {
  return Array.from(requiredFilters).every(filter => filters.has(filter));
}

export function shouldRefineBroadCourseMatch(
  filters: ReadonlySet<AnnouncementFilter>
): boolean {
  return (
    containsEveryFilter(filters, UNDERGRADUATE_COURSES) ||
    containsEveryFilter(filters, POSTGRADUATE_COURSES)
  );
}

export function isOnlyAllAnnouncementsFilter(
  filters: ReadonlySet<AnnouncementFilter>
): boolean {
  return filters.size === 1 && filters.has(AnnouncementFilter.ALL);
}

export function hasSpecificAudienceFilters(
  filters: ReadonlySet<AnnouncementFilter>
): boolean {
  return Array.from(filters).some(
    filter =>
      filter !== AnnouncementFilter.ALL &&
      filter !== AnnouncementFilter.RELEVANT
  );
}

export function addAllStudentAudienceFilters(
  filters: Set<AnnouncementFilter>
): void {
  Object.values(AnnouncementFilter).forEach(filter => {
    filters.add(filter);
  });
}

export function addUniversalSubscriptionFilters(
  filters: Set<AnnouncementFilter>,
  options: { isStudentRelevant: boolean }
): void {
  // `RELEVANT` is a subscription preference, not a KTU course code. Users who
  // choose it expect any student-relevant announcement, including course-specific
  // ones, but not administrative/general noise that only `ALL` subscribers asked for.
  if (options.isStudentRelevant) {
    filters.add(AnnouncementFilter.RELEVANT);
  }

  // `ALL` subscribers explicitly opted into every announcement, including items
  // that are not confidently student-relevant, so it is always included last.
  filters.add(AnnouncementFilter.ALL);
}

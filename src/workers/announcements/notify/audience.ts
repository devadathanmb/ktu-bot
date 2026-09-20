import {
  AnnouncementFilter,
  POSTGRADUATE_COURSES,
  UNDERGRADUATE_COURSES,
} from "../../../constants/courses.js";
import findCourseFiltersFromText from "../../../utils/find-course-filters-from-text.js";
import logger from "../../../utils/logger.js";

export interface AnnouncementClassifier {
  findRelevantCoursesFromAnnouncement(
    announcementContent: string
  ): Promise<Set<AnnouncementFilter>>;
  isAnnouncementRelevant(announcementContent: string): Promise<boolean>;
}

interface AnnouncementAudienceDeps {
  classifier: AnnouncementClassifier;
  sleep: (milliseconds: number) => Promise<void>;
}

export type AnnouncementAudienceResolver = (
  announcementContent: string
) => Promise<Set<AnnouncementFilter>>;

function containsEveryFilter(
  filters: ReadonlySet<AnnouncementFilter>,
  requiredFilters: ReadonlySet<AnnouncementFilter>
): boolean {
  return Array.from(requiredFilters).every(filter => filters.has(filter));
}

function shouldRefineBroadCourseMatch(
  filters: ReadonlySet<AnnouncementFilter>
): boolean {
  return (
    containsEveryFilter(filters, UNDERGRADUATE_COURSES) ||
    containsEveryFilter(filters, POSTGRADUATE_COURSES)
  );
}

function isOnlyAllAnnouncementsFilter(
  filters: ReadonlySet<AnnouncementFilter>
): boolean {
  return filters.size === 1 && filters.has(AnnouncementFilter.ALL);
}

function hasSpecificAudienceFilters(
  filters: ReadonlySet<AnnouncementFilter>
): boolean {
  return Array.from(filters).some(
    filter =>
      filter !== AnnouncementFilter.ALL &&
      filter !== AnnouncementFilter.RELEVANT
  );
}

function addAllStudentAudienceFilters(filters: Set<AnnouncementFilter>): void {
  Object.values(AnnouncementFilter).forEach(filter => {
    filters.add(filter);
  });
}

function addUniversalSubscriptionFilters(
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

export function createAnnouncementAudienceResolver(
  deps: AnnouncementAudienceDeps
): AnnouncementAudienceResolver {
  const { classifier, sleep } = deps;

  return async announcementContent => {
    const filters = findCourseFiltersFromText(announcementContent);

    logger.debug(
      {
        announcement: announcementContent,
        filters: Array.from(filters),
      },
      "Regex extracted course filters from announcement"
    );

    let isStudentRelevant = hasSpecificAudienceFilters(filters);

    // Broad phrases like "UG" or "PG" expand to every course in that group.
    // That is useful for reach, but too coarse for notifications, so we ask the
    // LLM for a narrower course list only when the extracted set actually
    // contains the whole UG/PG group instead of relying on set size alone.
    if (shouldRefineBroadCourseMatch(filters)) {
      logger.debug(
        "Broad course filters found, using LLM to determine specific relevant courses"
      );
      const llmMatchedCourses =
        await classifier.findRelevantCoursesFromAnnouncement(
          announcementContent
        );
      logger.debug(
        {
          llmMatchedCourses: Array.from(llmMatchedCourses),
          announcement: announcementContent,
        },
        "LLM matched courses from announcement"
      );
      if (llmMatchedCourses.size > 0) {
        filters.clear();
        llmMatchedCourses.forEach(courseCode => {
          filters.add(courseCode);
        });
      }
      isStudentRelevant = true;
    }

    // General announcements with no course signal need an LLM relevance check.
    // If relevant, we target every course filter plus `RELEVANT`; if not, only
    // `ALL` subscribers receive it via addUniversalSubscriptionFilters below.
    if (isOnlyAllAnnouncementsFilter(filters)) {
      // Stagger LLM calls to avoid bursts
      await sleep(2 * 1000);

      logger.debug("No specific filters found, checking relevancy with LLM");
      const isRelevant =
        await classifier.isAnnouncementRelevant(announcementContent);

      if (isRelevant) {
        logger.debug(
          "Announcement deemed relevant by LLM, adding all student audience filters"
        );
        addAllStudentAudienceFilters(filters);
      }
      isStudentRelevant = isRelevant;
    }

    addUniversalSubscriptionFilters(filters, { isStudentRelevant });

    return filters;
  };
}

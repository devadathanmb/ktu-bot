import type { AcademicCalendar } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchAcademicCalendars } from "../../../api/services/index.js";
import { AcademicCalendarsRepository } from "../../../db/repositories/academic-calendars-repository.js";
import { academicCalendars } from "../../../db/schema/academic-calendars.js";
import type { DatabaseInstance } from "../../../db/types.js";

type AcademicCalendarInsert = typeof academicCalendars.$inferInsert;

export class AcademicCalendarsSyncer extends BaseResourceSyncer<
  AcademicCalendar,
  AcademicCalendarInsert
> {
  readonly name = "academic_calendars";
  protected readonly pageSize = 100;
  protected readonly batchSize = 20;

  protected fetchPage(pageNumber: number): Promise<AcademicCalendar[]> {
    return fetchAcademicCalendars({
      pageNumber,
      dataSize: this.pageSize,
      apiClient: this.apiClient,
    });
  }

  protected transformFromApi(item: AcademicCalendar): AcademicCalendarInsert {
    return AcademicCalendarsRepository.transformFromApi(item);
  }

  protected createRepo(dbInstance: DatabaseInstance) {
    return new AcademicCalendarsRepository(dbInstance);
  }
}

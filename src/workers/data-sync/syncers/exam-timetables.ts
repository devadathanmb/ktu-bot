import type { ExamTimeTable } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchTimetables } from "../../../api/services/index.js";
import { ExamTimetablesRepository } from "../../../db/repositories/exam-timetables-repository.js";
import { examTimetables } from "../../../db/schema/exam-timetables.js";
import type { DatabaseInstance } from "../../../db/types.js";

type ExamTimetableInsert = typeof examTimetables.$inferInsert;

export class ExamTimetablesSyncer extends BaseResourceSyncer<
  ExamTimeTable,
  ExamTimetableInsert
> {
  readonly name = "exam_timetables";
  protected readonly pageSize = 100;
  protected readonly batchSize = 20;

  protected fetchPage(pageNumber: number): Promise<ExamTimeTable[]> {
    return fetchTimetables({
      pageNumber,
      dataSize: this.pageSize,
      apiClient: this.apiClient,
    });
  }

  protected transformFromApi(item: ExamTimeTable): ExamTimetableInsert {
    return ExamTimetablesRepository.transformFromApi(item);
  }

  protected createRepo(dbInstance: DatabaseInstance) {
    return new ExamTimetablesRepository(dbInstance);
  }
}

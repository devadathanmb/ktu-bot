import type { Announcement } from "../../../types/service.types.js";
import { BaseResourceSyncer } from "./base.js";
import { fetchAnnouncements } from "../../../api/services/index.js";
import { AnnouncementsRepository } from "../../../db/repositories/announcements-repository.js";
import { announcements } from "../../../db/schema/announcements.js";
import type { DatabaseInstance } from "../../../db/types.js";

type AnnouncementInsert = typeof announcements.$inferInsert;

export class AnnouncementsSyncer extends BaseResourceSyncer<
  Announcement,
  AnnouncementInsert
> {
  readonly name = "announcements";
  protected readonly pageSize = 100;
  protected readonly batchSize = 20;

  protected fetchPage(pageNumber: number): Promise<Announcement[]> {
    return fetchAnnouncements({
      pageNumber,
      dataSize: this.pageSize,
      apiClient: this.apiClient,
    });
  }

  protected transformFromApi(item: Announcement): AnnouncementInsert {
    return AnnouncementsRepository.transformFromApi(item);
  }

  protected createRepo(dbInstance: DatabaseInstance) {
    return new AnnouncementsRepository(dbInstance);
  }
}

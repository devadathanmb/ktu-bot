export interface Attachment {
  name: string;
  encryptId: string;
}

export interface Announcement {
  id: number;
  subject: string;
  formattedPublishedDate: string;
  publishedAt: Date | null;
  message: string;
  attachments: Attachment[];
}

// Their API returns inconsistent format for resources that can have attachments
// Some return `attachmentId` as nullable, some as non-nullable
// Some return `fileName` as nullable, some as non-nullable
// We have to live with this
export interface ExamTimeTable {
  id: number;
  attachmentId: number | null;
  title: string;
  encryptId: string | null;
  publishedAt: Date | null;
  formattedPublishedDate: string;
  fileName: string | null;
}

export interface AcademicCalendar {
  id: number;
  title: string;
  attachmentId: number;
  publishedAt: Date | null;
  formattedPublishedDate: string;
  attachmentName: string;
  encryptId: string;
}

// Hugging Face Relevancy Service Types
export interface RelevancyScore {
  label: string;
  score: number;
}

// UptimeRobot API Status Service Types
export interface ApiStatusLog {
  type: string;
  timestamp: string;
  duration: number;
  reason: string;
}

export interface ApiStatus {
  name: string;
  url: string;
  status: string;
  log: ApiStatusLog | null;
  responseTime: number;
}

export interface ApiStatusResponse {
  monitors: ApiStatus[];
}

// Temporary File Upload Service Types
export interface TempFileUploadParams {
  filePath: string;
  fileName?: string;
}

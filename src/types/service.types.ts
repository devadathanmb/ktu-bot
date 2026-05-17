export type AttachmentSource = "default" | "syllabus";

export interface Attachment {
  name: string;
  encryptId: string;
  source?: AttachmentSource;
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

// Syllabus Lookup Service Types
export interface Program {
  id: number;
  name: string;
  description: string | null;
}

export interface Scheme {
  id: number;
  scheme: string;
  academicYear: string;
  programTypeName: string;
}

export interface Branch {
  id: number; // curriculumId used in getSyllabus
  branchName: string;
  schemeName: string;
  programTypeName: string;
  academicYear: string;
}

export interface SyllabusEntry {
  attachmentId: number | null;
  encryptAttachmentId: string | null;
  attachmentName: string | null;
  description: string | null;
}

interface ResultDetails {
  courseName: string;
  grade: string;
  credits: number;
}

interface ResultSummary {
  firstName: string;
  lastName: string | null;
  middleName: string | null;
  branch: string;
  semester: string;
  registrerNo: string;
  institutionName: string;
  resultName: string;
}

interface PublishedResultData {
  id: number;
  resultName: string;
  publishedData: string;
  examDefId: number;
  schemeId: number;
}

interface Course {
  id: number;
  name: string;
}

interface Attachment {
  name: string;
  encryptId: string;
}

interface Announcement {
  id: number;
  subject: string;
  date: string;
  attachments: Attachment[];
}
export {
  ResultDetails,
  ResultSummary,
  PublishedResultData,
  Course,
  Attachment,
  Announcement,
};

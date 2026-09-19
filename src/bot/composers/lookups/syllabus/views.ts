import { emoji } from "@grammyjs/emoji";
import { FormattedString } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import {
  Branch,
  Program,
  Scheme,
  SyllabusEntry,
} from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
  slicePage,
} from "../utils.js";
import { LOOKUP_CONFIG } from "../constants.js";
import { CB } from "./constants.js";

export interface SyllabusPage {
  text: FormattedString;
  keyboard: InlineKeyboard;
}

function programsToPageItems(programs: Program[]): PaginatedItem[] {
  return programs.map(program => ({
    id: program.id,
    subject: program.name,
    formattedPublishedDate: program.description ?? "",
  }));
}

function schemesToPageItems(schemes: Scheme[]): PaginatedItem[] {
  return schemes.map(scheme => ({
    id: scheme.id,
    subject: scheme.scheme,
    formattedPublishedDate: `${scheme.academicYear} · ${scheme.programTypeName}`,
  }));
}

function branchesToPageItems(branches: Branch[]): PaginatedItem[] {
  return branches.map(branch => ({
    id: branch.id,
    subject: branch.branchName,
    formattedPublishedDate: branch.academicYear,
  }));
}

function syllabusEntriesToPageItems(
  entries: SyllabusEntry[],
  originalIndices: number[]
): PaginatedItem[] {
  return entries.map((entry, index) => ({
    id: originalIndices[index]!,
    subject: entry.attachmentName ?? entry.description ?? "Syllabus",
    formattedPublishedDate: entry.description ?? "",
  }));
}

export function getDownloadableEntries(entries: SyllabusEntry[]): {
  entries: SyllabusEntry[];
  indices: number[];
} {
  const downloadable: SyllabusEntry[] = [];
  const indices: number[] = [];
  entries.forEach((entry, index) => {
    if (entry.encryptAttachmentId !== null && entry.attachmentName !== null) {
      downloadable.push(entry);
      indices.push(index);
    }
  });
  return { entries: downloadable, indices };
}

export function buildProgramsPage(
  programs: Program[],
  page: number
): SyllabusPage {
  const pageItems = slicePage(programsToPageItems(programs), page);
  return {
    text: generatePaginatedMessageText(
      pageItems,
      `${emoji("scroll")} Syllabus Lookup — Select Program`,
      "program",
      "Description"
    ),
    keyboard: generatePaginatedKeyboard(
      pageItems,
      page,
      CB.PROGRAM,
      LOOKUP_CONFIG.ITEMS_PER_ROW
    ),
  };
}

export function buildSchemesPage(
  schemes: Scheme[],
  page: number
): SyllabusPage {
  const pageItems = slicePage(schemesToPageItems(schemes), page);
  return {
    text: generatePaginatedMessageText(
      pageItems,
      `${emoji("scroll")} Syllabus Lookup — Select Scheme`,
      "scheme",
      "Academic year"
    ),
    keyboard: generatePaginatedKeyboard(
      pageItems,
      page,
      CB.SCHEME,
      LOOKUP_CONFIG.ITEMS_PER_ROW
    ),
  };
}

export function buildBranchesPage(
  branches: Branch[],
  page: number
): SyllabusPage {
  const pageItems = slicePage(branchesToPageItems(branches), page);
  return {
    text: generatePaginatedMessageText(
      pageItems,
      `${emoji("scroll")} Syllabus Lookup — Select Branch`,
      "branch",
      "Academic year"
    ),
    keyboard: generatePaginatedKeyboard(
      pageItems,
      page,
      CB.BRANCH,
      LOOKUP_CONFIG.ITEMS_PER_ROW
    ),
  };
}

export function buildSyllabusEntriesPage(
  entries: SyllabusEntry[],
  page: number
): SyllabusPage {
  const { entries: downloadable, indices } = getDownloadableEntries(entries);
  const pageItems = slicePage(
    syllabusEntriesToPageItems(downloadable, indices),
    page
  );
  return {
    text: generatePaginatedMessageText(
      pageItems,
      `${emoji("scroll")} Syllabus Lookup — Select Entry`,
      "entry",
      "Description"
    ),
    keyboard: generatePaginatedKeyboard(
      pageItems,
      page,
      CB.SYLLABUS,
      LOOKUP_CONFIG.ITEMS_PER_ROW
    ),
  };
}

import {
  SEARCH_PREFIXES_TO_TYPE_MAP,
  SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP,
  SearchType,
} from "./search-types.js";

export function parseQuery(query: string): {
  type: SearchType | null;
  searchTerm: string;
} {
  const trimmedQuery = query.trim();

  for (const [prefix, type] of Object.entries(SEARCH_PREFIXES_TO_TYPE_MAP)) {
    if (trimmedQuery.startsWith(prefix)) {
      return {
        type,
        searchTerm: trimmedQuery.slice(prefix.length).trim(),
      };
    }
  }

  return { type: null, searchTerm: trimmedQuery };
}

export function getSearchTypeFromPrefix(prefix: string): SearchType | null {
  for (const [searchType, idPrefix] of Object.entries(
    SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP
  )) {
    if (idPrefix === prefix) {
      return searchType as SearchType;
    }
  }
  return null;
}

/**
 * Constants for lookup composers to avoid magic numbers
 */
export const LOOKUP_CONFIG = {
  /** Number of items to fetch per page */
  PAGE_SIZE: 10,

  /** Number of item buttons to display per row in keyboard */
  ITEMS_PER_ROW: 5,

  /** Initial page number for pagination */
  INITIAL_PAGE: 0,
} as const;

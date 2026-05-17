import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { Scheme } from "../../../types/service.types.js";
import type { Got } from "got";

interface FetchSchemesParams {
  programId: number;
  apiClient?: Got;
}

const SchemesResponseSchema = z.array(
  z.object({
    id: z.number(),
    scheme: z.string(),
    academicYear: z.string(),
    programTypeName: z.string(),
  })
);

async function _fetchSchemes({
  programId,
  apiClient,
}: FetchSchemesParams): Promise<Scheme[]> {
  const c = apiClient ?? cachedApiClient;
  const response = await c.post(KTU_API_SERVICE_ENDPOINTS.GET_SCHEMES, {
    json: { id: programId },
  });

  const data = SchemesResponseSchema.parse(response.body);

  return data.map(s => ({
    id: s.id,
    scheme: s.scheme,
    academicYear: s.academicYear,
    programTypeName: s.programTypeName,
  }));
}

export const fetchSchemes = withServiceWrapper("fetchSchemes", _fetchSchemes);

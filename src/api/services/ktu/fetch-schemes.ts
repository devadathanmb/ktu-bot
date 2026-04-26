import { z } from "zod";
import client from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { Scheme } from "../../../types/service.types.js";

interface FetchSchemesParams {
  programId: number;
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
}: FetchSchemesParams): Promise<Scheme[]> {
  const response = await client.post(KTU_API_SERVICE_ENDPOINTS.GET_SCHEMES, {
    json: { id: programId },
    responseType: "json" as const,
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

import { z } from "zod";
import client from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { Program } from "../../../types/service.types.js";

const ProgramsResponseSchema = z.array(
  z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().nullable().optional(),
  })
);

async function _fetchPrograms(): Promise<Program[]> {
  const response = await client.post(KTU_API_SERVICE_ENDPOINTS.GET_PROGRAMS, {
    json: "",
    responseType: "json" as const,
  });

  const data = ProgramsResponseSchema.parse(response.body);

  return data
    .sort((a, b) => a.id - b.id)
    .map(p => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
    }));
}

export const fetchPrograms = withServiceWrapper(
  "fetchPrograms",
  _fetchPrograms
);

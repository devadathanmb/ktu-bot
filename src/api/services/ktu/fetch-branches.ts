import { z } from "zod";
import client from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { Branch } from "../../../types/service.types.js";

interface FetchBranchesParams {
  schemeId: number;
}

const BranchesResponseSchema = z.object({
  content: z.array(
    z.object({
      id: z.number(),
      branchName: z.string(),
      schemeName: z.string(),
      programTypeName: z.string(),
      academicYear: z.string(),
    })
  ),
});

async function _fetchBranches({
  schemeId,
}: FetchBranchesParams): Promise<Branch[]> {
  const response = await client.post(KTU_API_SERVICE_ENDPOINTS.GET_BRANCHES, {
    json: { number: 0, size: 100, id: schemeId, branchId: null },
    responseType: "json" as const,
  });

  const data = BranchesResponseSchema.parse(response.body);

  return data.content.map(b => ({
    id: b.id,
    branchName: b.branchName,
    schemeName: b.schemeName,
    programTypeName: b.programTypeName,
    academicYear: b.academicYear,
  }));
}

export const fetchBranches = withServiceWrapper(
  "fetchBranches",
  _fetchBranches
);

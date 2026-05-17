import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { Branch } from "../../../types/service.types.js";
import type { Got } from "got";

interface FetchBranchesParams {
  schemeId: number;
  apiClient?: Got;
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
  apiClient,
}: FetchBranchesParams): Promise<Branch[]> {
  const c = apiClient ?? cachedApiClient;
  const response = await c.post(KTU_API_SERVICE_ENDPOINTS.GET_BRANCHES, {
    json: { number: 0, size: 100, id: schemeId, branchId: null },
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

import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { BETTER_UPTIME_API } from "../../../constants/api.js";
import { ExternalApiConfig } from "../../../configs/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import logger from "../../../utils/logger.js";
import type {
  ApiStatus,
  ApiStatusResponse,
} from "../../../types/service.types.js";

const BetterUptimeMonitorSchema = z.object({
  id: z.string(),
  type: z.literal("monitor"),
  attributes: z.object({
    pronounceable_name: z.string(),
    url: z.string(),
    status: z.enum([
      "up",
      "down",
      "paused",
      "pending",
      "maintenance",
      "validating",
    ]),
  }),
});

const BetterUptimeMonitorsResponseSchema = z.object({
  data: z.array(BetterUptimeMonitorSchema),
});

const BetterUptimeResponseTimeSchema = z.object({
  data: z.object({
    id: z.string(),
    type: z.literal("monitor_response_times"),
    attributes: z.object({
      regions: z.array(
        z.object({
          region: z.string(),
          response_times: z.array(
            z.object({
              at: z.string(),
              response_time: z.number(), // in seconds
            })
          ),
        })
      ),
    }),
  }),
});

async function _getApiStatus(): Promise<ApiStatusResponse> {
  const monitorsResponse = await cachedApiClient.get(
    `${BETTER_UPTIME_API.MONITOR_GROUPS_ENDPOINT}/${ExternalApiConfig.BETTER_UPTIME_MONITOR_GROUP_ID}/monitors`,
    {
      headers: {
        Authorization: `Bearer ${ExternalApiConfig.BETTER_UPTIME_API_TOKEN}`,
      },
      timeout: {
        request: 10000,
      },
    }
  );

  const monitorsData = BetterUptimeMonitorsResponseSchema.parse(
    monitorsResponse.body
  );

  const monitors: ApiStatus[] = await Promise.all(
    monitorsData.data.map(async monitor => {
      let responseTime = 0;

      try {
        const responseTimesResponse = await cachedApiClient.get(
          `${BETTER_UPTIME_API.MONITORS_ENDPOINT}/${monitor.id}/response-times`,
          {
            headers: {
              "Authorization": `Bearer ${ExternalApiConfig.BETTER_UPTIME_API_TOKEN}`,
              "Cache-Control": "no-cache",
            },
            timeout: {
              request: 5000,
            },
          }
        );

        const responseTimesData = BetterUptimeResponseTimeSchema.parse(
          responseTimesResponse.body
        );

        const firstRegion = responseTimesData.data.attributes.regions[0];
        const firstResponseTime = firstRegion?.response_times[0];
        if (firstResponseTime) {
          // Convert from seconds to milliseconds
          responseTime = firstResponseTime.response_time * 1000;
        }
      } catch (error) {
        logger.warn(
          { err: error as Error, monitorId: monitor.id },
          "Failed to fetch response times for monitor"
        );
      }

      return {
        name: monitor.attributes.pronounceable_name,
        url: monitor.attributes.url,
        status: monitor.attributes.status === "up" ? "up" : "down",
        log: null,
        responseTime: responseTime,
      };
    })
  );

  return { monitors };
}

export const getApiStatus = withServiceWrapper("getApiStatus", _getApiStatus);

import { z } from "zod";
import client from "../../client.js";
import { UPTIME_ROBOT_API } from "../../../constants/api.js";
import { ExternalApiConfig } from "../../../configs/api.js";
import { withServiceWrapper } from "../../utils/serviceWrapper.js";
import type { ApiStatus, ApiStatusLog } from "../../../types/service.types.js";

// Zod schemas for UptimeRobot API response validation
const UptimeRobotLogSchema = z.object({
  type: z.number(),
  datetime: z.number(),
  duration: z.number(),
  reason: z
    .object({
      detail: z.string(),
    })
    .optional(),
});

const UptimeRobotMonitorSchema = z.object({
  status: z.number(),
  average_response_time: z.coerce.number(), // API returns this as a string, coerce to number
  logs: z.array(UptimeRobotLogSchema),
});

const UptimeRobotResponseSchema = z.object({
  monitors: z.array(UptimeRobotMonitorSchema),
});

// Map UptimeRobot status codes to readable status
function mapStatus(statusCode: number): string {
  switch (statusCode) {
    case 2:
      return "up";
    case 9:
      return "down";
    case 8:
      return "seems down";
    default:
      return "unknown";
  }
}

// Map log type codes to readable strings
function mapLogType(typeCode: number): string {
  switch (typeCode) {
    case 2:
      return "up";
    case 1:
      return "down";
    default:
      return "unknown";
  }
}

// Format timestamp from Unix timestamp to localized string
function formatTimestamp(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "long",
  }).format(date);
}

async function _getApiStatus(): Promise<ApiStatus> {
  const formData = new FormData();
  formData.append("api_key", ExternalApiConfig.UPTIME_ROBOT_API_KEY);
  formData.append("format", "json");
  formData.append("logs", "1");
  formData.append("logs_limit", "1");
  formData.append("response_times", "1");

  // Use regular client for API status - should always be fresh
  const response = await client.post(UPTIME_ROBOT_API.MONITORS_ENDPOINT, {
    body: formData,
    responseType: "json" as const,
    headers: {
      "Cache-Control": "no-cache",
    },
    timeout: {
      request: 10000,
    },
  });

  // Validate API response with Zod
  const data = UptimeRobotResponseSchema.parse(response.body);

  if (!data.monitors || data.monitors.length === 0) {
    throw new Error("No monitor data available from UptimeRobot API");
  }

  const monitor = data.monitors[0];
  if (!monitor) {
    throw new Error("No monitor data available from UptimeRobot API");
  }

  const apiStatus: ApiStatus = {
    status: mapStatus(monitor.status),
    log: null,
    responseTime: monitor.average_response_time || 0,
  };

  // Process log information if available
  const log = monitor.logs?.[0];
  if (log) {
    const apiLog: ApiStatusLog = {
      type: mapLogType(log.type),
      timestamp: formatTimestamp(log.datetime),
      duration: Math.round(log.duration / (60 * 60)), // Convert seconds to hours
      reason: log.reason?.detail || "unknown",
    };

    apiStatus.log = apiLog;
  }

  return apiStatus;
}

// Export the wrapped version with error handling
export const getApiStatus = withServiceWrapper("getApiStatus", _getApiStatus);

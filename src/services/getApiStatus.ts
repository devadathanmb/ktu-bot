import { axios } from "@/api/axiosInstance";

interface Log {
  type: string;
  timestamp: string;
  duration: number;
  reason: string;
}

interface ApiStatus {
  status: string;
  log: Log | null;
  responseTime: number;
}

async function getApiStatus() {
  const URL = "https://api.uptimerobot.com/v2/getMonitors";
  const headers = {
    "Cache-Control": "no-cache",
  };
  try {
    const formData = new FormData();
    formData.append("api_key", process.env.UPTIME_ROBOT_API_KEY!);
    formData.append("format", "json");
    formData.append("logs", "1");
    formData.append("logs_limit", "1");
    formData.append("response_times", "1");

    const response = await axios.post(URL, formData, {
      headers,
      cache: {
        ttl: 1000 * 60,
      },
    });

    let apiStatus: ApiStatus = {
      status: "",
      log: null,
      responseTime: response.data.monitors[0].average_response_time,
    };
    const status: number = response.data.monitors[0].status;

    if (status === 2) {
      apiStatus.status = "up";
    } else if (status === 9) {
      apiStatus.status = "down";
    } else if (status === 8) {
      apiStatus.status = "seems down";
    } else {
      apiStatus.status = "unknown";
    }
    const log = response.data.monitors[0].logs[0];
    if (log) {
      let apiLog: Log = {
        type: "",
        timestamp: "",
        duration: 0,
        reason: "",
      };
      if (log.type === 2) {
        apiLog.type = "up";
      } else if (log.type === 1) {
        apiLog.type = "down";
      } else {
        apiLog.type = "unknown";
      }

      const date = new Date(log.datetime * 1000);
      const localDate = new Intl.DateTimeFormat("en-IN", {
        dateStyle: "full",
        timeStyle: "long",
      }).format(date);
      apiLog.timestamp = localDate;
      apiLog.duration = Math.round(log.duration / (60 * 60)); // get in hours

      if (log.reason) {
        apiLog.reason = log.reason.detail;
      } else {
        apiLog.reason = "unknown";
      }

      apiStatus.log = apiLog;
      return apiStatus;
    }
    return apiStatus;
  } catch (error) {
    throw error;
  }
}

export default getApiStatus;

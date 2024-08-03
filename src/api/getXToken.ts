import axios from "axios";
import { BypassData } from "./getBypassData";
import logger from "@/utils/logger";

const X_TOKEN_URL = "http://captcha-bypass:3000/get_token";

interface XToken {
  x_token: string;
}

class InvalidXTokenError extends Error {
  constructor(message: string = "Invalid X-Token") {
    super(message);
    this.name = "InvalidXTokenError";
  }
}

async function getXToken(bypassData: BypassData): Promise<XToken | null> {
  try {
    const response = await axios.post(X_TOKEN_URL, bypassData, {
      // Axios cache interceptor takes over axios instance
      // So we need to disable cache here
      //@ts-ignore
      cache: false,
    });
    const xToken: XToken = response.data;
    if (!xToken.x_token) {
      throw new InvalidXTokenError();
    }
    return xToken;
  } catch (error) {
    logger.error(`Error in fetching X-Token: ${error}`);
    throw error;
  }
}

export { getXToken };

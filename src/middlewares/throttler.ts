// Throttler middleware to avoid abuse by spam
import { telegrafThrottler, ThrottlerOptions } from "telegraf-throttler";

const opts: ThrottlerOptions = {
  inKey: "chat",
};

const throttler = telegrafThrottler(opts);

export default throttler;

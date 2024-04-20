// Throttler middleware to avoid abuse by spam
import { telegrafThrottler, ThrottlerOptions } from "telegraf-throttler";

let opts: ThrottlerOptions = {
  out: {
    minTime: 25,
    reservoir: 30,
    reservoirRefreshAmount: 30,
    reservoirRefreshInterval: 1000,
  },
};

/*
  In PRODUCTION, that is in webhook mode, each update from chat, that is per user update is sent one by one.
  Which means, telegram itself rate limits in on their side before sending the request. Hence we do not need to do it again here. 
  NOTE: Currently, telegraf-throttler doesn't support disabling one kind of throttling. Hence we are just passing default Bottleneck values.
  This needs to be fixed on throttler possibly with a PR.
*/
if (process.env.ENV_TYPE === "PRODUCTION") {
  opts.in = {};
}

const throttler = telegrafThrottler(opts);

export default throttler;

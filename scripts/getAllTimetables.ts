import logger from "../src/utils/logger.js";
import { fetchTimetables } from "../src/api/services/index.js";

import { writeFileSync } from "fs";

async function main() {
  let index = 0;
  const fetchedData = [];
  // Keep fetching data until no more data is returned
  while (true) {
    const timetables = await fetchTimetables({
      pageNumber: index,
      dataSize: 100,
    });

    if (timetables.length == 0) {
      logger.info("No more timetables to fetch. Exiting.");
      break;
    }

    logger.info(`Fetched ${timetables.length} timetables from page ${index}.`);
    index += 1;

    // Store the fetched timetables
    fetchedData.push(...timetables);
  }

  // Save the fetched data to a JSON file
  const fileName = "timetables.json";
  writeFileSync(fileName, JSON.stringify(fetchedData, null, 2));
  logger.info(`Saved ${fetchedData.length} timetables to ${fileName}`);
}

await main();

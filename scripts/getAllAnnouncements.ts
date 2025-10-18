import logger from "../src/utils/logger";
import { fetchAnnouncements } from "../src/api/services/ktu/fetchAnnouncements.js";
import { writeFileSync } from "fs";

async function main() {
  let index = 0;
  const fetchedData = [];
  // Keep fetching data until no more data is returned
  while (true) {
    const announcements = await fetchAnnouncements({
      pageNumber: index,
      dataSize: 100,
      cache: false,
    });

    if (announcements.length == 0) {
      logger.info("No more announcements to fetch. Exiting.");
      break;
    }

    logger.info(
      `Fetched ${announcements.length} announcements from page ${index}.`
    );
    index += 1;

    // Store the fetched announcements
    fetchedData.push(...announcements);
  }

  // Save the fetched data to a JSON file
  const fileName = "announcements.json";
  writeFileSync(fileName, JSON.stringify(fetchedData, null, 2));
  logger.info(`Saved ${fetchedData.length} announcements to ${fileName}`);
}

await main();

import { FILTERS_REGEX } from "constants/constants";
// This function will find the list of course filters based on the input text message
// using basic string matching

function findFilters(msg: string): Array<string> {
  // If the input message is empty, return the general filter
  if (!msg) {
    return ["general"];
  }

  // Convert the input message to lowercase
  const lowerCaseMsg = msg.toLowerCase();

  // Match the input message with the available filters
  // Return the list of matched filters
  let matchedFilters: Array<string> = [];

  Object.keys(FILTERS_REGEX).forEach((filter) => {
    if (lowerCaseMsg.search(new RegExp(filter)) !== -1) {
      matchedFilters.push(...FILTERS_REGEX[filter]);
    }
  });

  if (matchedFilters.length === 0) {
    matchedFilters.push("general");
  }

  return matchedFilters;
}

export default findFilters;

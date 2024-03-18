// Function to shorten long strings in messages to respect bot api character limits

function shortenString(str: string) {
  if (str.length > 300) {
    return str.substring(0, 300).concat("...");
  } else {
    return str;
  }
}

export default shortenString;

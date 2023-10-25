function formatDob(dob: string) {
  const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dob.match(regex);
  if (!match) {
    throw new Error("Invalid date of birth");
  }
  const [, day, month, year] = match.map(Number);
  if (
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 1000 ||
    year > 3000
  ) {
    throw new Error("Invalid date values");
  }
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return `${year}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

export default formatDob;

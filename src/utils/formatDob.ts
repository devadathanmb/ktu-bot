function formatDob(dob: string) {
  const [day, month, year] = dob.split("/");
  if (!day || !month || !year) {
    throw new Error("Invalid date of birth");
  }
  const date = new Date(
    Number.parseInt(year),
    Number.parseInt(month) - 1,
    Number.parseInt(day),
  );
  return `${year}-${month}-${day}`;
}

export default formatDob;

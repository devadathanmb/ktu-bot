function formatDate(date: string) {
  if (!date) {
    return "";
  }
  let formattedDate = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(new Date(date))
    .toString();
  formattedDate = formattedDate.concat(
    ` (${date.split("-").reverse().join("/")})`
  );
  return formattedDate;
}

export default formatDate;

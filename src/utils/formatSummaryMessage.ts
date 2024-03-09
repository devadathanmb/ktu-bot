function formatSummaryMessage(summary: any) {
  const fullName = summary.lastName
    ? `${summary.firstName} ${
        summary.middleName ? summary.middleName + " " : ""
      }${summary.lastName}`
    : summary.firstName;

  return (
    `<u><b>Result Details</b></u>\n\n\n` +
    `<b>Name:</b> <b>${fullName}</b>\n\n` +
    `<b>Branch:</b> <b>${summary.branch}</b>\n\n` +
    `<b>Semester:</b> <b>${summary.semester}</b>\n\n` +
    `<b>Register No:</b> <b>${summary.registrerNo}</b>\n\n` +
    `<b>Institution:</b> <b>${summary.institutionName}</b>\n\n` +
    `<b>Result Name:</b> <b>${summary.resultName}</b>\n\n`
  );
}

export default formatSummaryMessage;

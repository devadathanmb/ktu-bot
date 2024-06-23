function formatSummaryMessage(summary: any) {
  return (
    `<u><b>Result Details</b></u>\n\n` +
    `<b>• Name:</b> ${summary.fullName}\n\n` +
    `<b>• Branch:</b> ${summary.branch}\n\n` +
    `<b>• Semester:</b> ${summary.semester}\n\n` +
    `<b>• Register No:</b> ${summary.registrerNo}\n\n` +
    `<b>• Institution:</b> ${summary.institutionName}\n\n` +
    `<b>• Result Name:</b> ${summary.resultName}\n\n`
  );
}

export default formatSummaryMessage;

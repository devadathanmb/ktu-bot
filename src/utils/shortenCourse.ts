function shortenCourse(subject: string): string {
  let shortenedName = "";
  subject
    .trim()
    .split(" ")
    .forEach((word) => {
      if (word) {
        shortenedName = shortenedName.concat(word[0]);
      }
    });
  return shortenedName;
}

export default shortenCourse;

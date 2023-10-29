class InvalidDataError extends Error {
  constructor(message: string = "Invalid data provided.") {
    super(message);
    this.name = "InvalidDataError";
  }
}

export default InvalidDataError;

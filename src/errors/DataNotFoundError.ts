class DataNotFoundError extends Error {
  constructor(message = "Data not found.") {
    super(message);
    this.name = "DataNotFound";
  }
}

export default DataNotFoundError;

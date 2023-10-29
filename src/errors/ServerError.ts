class ServerError extends Error {
  constructor(
    message: string = "KTU servers are down right now. Please try again later.",
  ) {
    super(message);
    this.name = "ServerError";
  }
}
export default ServerError;

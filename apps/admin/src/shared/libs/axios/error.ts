class AxiosCustomError<T> extends Error {
  statusCode: number;
  response?: T;

  constructor(message: string, statusCode: number, response?: T) {
    super(message);
    this.name = "AxiosCustomError";
    this.statusCode = statusCode;
    this.response = response;
  }
}

export default AxiosCustomError;

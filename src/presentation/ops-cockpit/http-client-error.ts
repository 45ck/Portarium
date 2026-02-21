export class ControlPlaneClientError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(status: number, body: string) {
    super(`Control Plane request failed with status ${status}.`);
    this.name = 'ControlPlaneClientError';
    this.status = status;
    this.body = body;
  }
}

export class DependencyCascadeError extends Error {
  constructor(public readonly service: string) {
    super(`Dependency unavailable: ${service}`);
    this.name = "DependencyCascadeError";
  }
}

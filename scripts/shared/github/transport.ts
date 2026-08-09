export type GithubMethod = 'GET' | 'POST' | 'PUT';

export interface GithubRequest {
  method: GithubMethod;
  path: string;
  body?: unknown;
}

export interface GithubTransport {
  execute<T>(request: GithubRequest): Promise<T>;
}

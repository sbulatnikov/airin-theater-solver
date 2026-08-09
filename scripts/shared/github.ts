import { run } from "./command.ts";

export interface GitHubUser {
  id: number;
  login: string;
  html_url: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: GitHubUser;
}

export function parseGitHubRepository(remoteUrl: string): string {
  const match = remoteUrl
    .trim()
    .match(/^(?:git@github\.com:|ssh:\/\/git@github\.com\/|https?:\/\/github\.com\/)([^/\s]+\/[^/\s]+?)(?:\.git)?$/i);
  if (!match) throw new Error(`Origin не является GitHub repository: ${remoteUrl}.`);
  return match[1];
}

export function currentGitHubRepository(): string {
  return parseGitHubRepository(run("git", ["remote", "get-url", "origin"]));
}

export async function githubRequest<T>(repository: string, path: string, token?: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "airin-theater-solver-release-tools",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`GitHub API ${path} вернул ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export function pullRequest(repository: string, number: number, token?: string): Promise<GitHubPullRequest> {
  return githubRequest<GitHubPullRequest>(repository, `/pulls/${number}`, token);
}

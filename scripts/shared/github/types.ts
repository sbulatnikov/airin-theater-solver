export interface GithubUser {
  id: number;
  login: string;
  html_url: string;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed';
  draft: boolean;
  html_url: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  user: GithubUser;
}

export interface GithubBranchProtection {
  required_status_checks: null;
  enforce_admins: boolean;
  required_pull_request_reviews: null;
  restrictions: null;
  required_linear_history: boolean;
  allow_force_pushes: boolean;
  allow_deletions: boolean;
  block_creations: boolean;
  required_conversation_resolution: boolean;
  lock_branch: boolean;
  allow_fork_syncing: boolean;
}

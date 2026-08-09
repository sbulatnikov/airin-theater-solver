import type { GitTransport } from './transport.ts';

export interface GitCommitOptions {
  author: string;
  body: string;
  subject: string;
}

export interface GitTagQuery {
  mergedInto?: string;
  pointsAt?: string;
  sort?: string;
}

export interface GitIdentity {
  email: string;
  name: string;
}

export interface GitClientConfig {
  pushRemote?: string;
  tagger?: GitIdentity;
}

export class GitClient {
  private readonly pushRemote: string;
  private readonly tagger?: GitIdentity;

  constructor(
    private readonly transport: GitTransport,
    config: GitClientConfig = {},
  ) {
    this.pushRemote = config.pushRemote ?? 'origin';
    this.tagger = config.tagger;
  }

  isClean(): boolean {
    return this.transport.execute(['status', '--porcelain=v1']) === '';
  }

  fetch(remote = 'origin', options: { prune?: boolean; tags?: boolean } = {}): void {
    const args = ['fetch'];
    if (options.prune) args.push('--prune');
    if (options.tags) args.push('--tags');
    args.push(remote);
    this.transport.execute(args);
  }

  fetchRef(remote: string, source: string, destination: string, force = false): void {
    this.transport.execute(['fetch', ...(force ? ['--force'] : []), remote, `${source}:${destination}`]);
  }

  getRemoteUrl(remote = 'origin'): string {
    return this.transport.execute(['remote', 'get-url', remote]);
  }

  getCurrentBranch(): string {
    return this.transport.execute(['branch', '--show-current']);
  }

  listBranches(): string[] {
    return this.lines(this.transport.execute(['branch', '--all', '--format=%(refname:short)']));
  }

  createBranch(branch: string, startPoint: string): void {
    this.transport.execute(['switch', '--create', branch, startPoint]);
  }

  resolve(revision: string): string {
    return this.transport.execute(['rev-parse', revision]);
  }

  commitFor(revision: string): string {
    return this.transport.execute(['rev-list', '-n', '1', revision]);
  }

  listTags(pattern: string, query: GitTagQuery = {}): string[] {
    const args = ['tag'];
    if (query.pointsAt) args.push('--points-at', query.pointsAt);
    args.push('--list', pattern);
    if (query.sort) args.push(`--sort=${query.sort}`);
    if (query.mergedInto) args.push('--merged', query.mergedInto);
    return this.lines(this.transport.execute(args));
  }

  tagExists(tag: string): boolean {
    return this.transport.succeeds(['rev-parse', '--verify', `refs/tags/${tag}`]);
  }

  createAnnotatedTag(tag: string, object: string, message: string): void {
    this.transport.execute(['tag', '--annotate', tag, object, '--message', message], {
      env: this.tagger
        ? {
            GIT_COMMITTER_EMAIL: this.tagger.email,
            GIT_COMMITTER_NAME: this.tagger.name,
          }
        : {},
    });
  }

  pushTag(tag: string): void {
    this.transport.push([this.pushRemote, `refs/tags/${tag}`]);
  }

  isAncestor(ancestor: string, descendant: string): boolean {
    return this.transport.succeeds(['merge-base', '--is-ancestor', ancestor, descendant]);
  }

  findCommitByMessage(message: string): string | undefined {
    const output = this.transport.execute(['log', '--fixed-strings', '--grep', message, '-1', '--format=%H']);
    return output || undefined;
  }

  changedFiles(range: string): string[] {
    return this.lines(this.transport.execute(['diff', '--name-only', range]));
  }

  squashMerge(revision: string): void {
    this.transport.execute(['merge', '--squash', '--no-commit', revision]);
  }

  hasStagedChanges(): boolean {
    return !this.transport.succeeds(['diff', '--cached', '--quiet']);
  }

  commit({ author, subject, body }: GitCommitOptions): void {
    this.transport.execute(['commit', `--author=${author}`, '--message', subject, '--message', body]);
  }

  log(range: string, format: string, reverse = false): string {
    return this.transport.execute(['log', ...(reverse ? ['--reverse'] : []), `--format=${format}`, range]);
  }

  private lines(output: string): string[] {
    return output
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
  }
}

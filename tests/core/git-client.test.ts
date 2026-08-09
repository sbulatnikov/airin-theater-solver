import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GitClient,
  GitClientFactory,
  GitCliTransport,
  type GitTransport,
  type GitTransportFactory,
} from '../../scripts/shared/git.ts';

class RecordingTransport implements GitTransport {
  readonly commands: string[][] = [];
  readonly pushes: string[][] = [];

  constructor(
    private readonly outputs: string[] = [],
    private readonly results: boolean[] = [],
  ) {}

  execute(args: string[]): string {
    this.commands.push(args);
    return this.outputs.shift() ?? '';
  }

  succeeds(args: string[]): boolean {
    this.commands.push(args);
    return this.results.shift() ?? true;
  }

  push(args: string[]): string {
    this.pushes.push(args);
    return '';
  }
}

afterEach(() => vi.unstubAllEnvs());

describe('GitClient', () => {
  it('owns annotated tag creation and publication', () => {
    const transport = new RecordingTransport();
    const git = new GitClient(transport, { pushRemote: 'https://github.com/owner/repository.git' });

    git.createAnnotatedTag('2026.2', 'commit-sha', 'Release 2026.2');
    git.pushTag('2026.2');

    expect(transport.commands).toEqual([['tag', '--annotate', '2026.2', 'commit-sha', '--message', 'Release 2026.2']]);
    expect(transport.pushes).toEqual([['https://github.com/owner/repository.git', 'refs/tags/2026.2']]);
  });

  it('stages release files, commits with the bot identity, and pushes main safely', () => {
    const transport = new RecordingTransport();
    const git = new GitClient(transport, {
      pushRemote: 'https://github.com/owner/repository.git',
      tagger: { name: 'release-bot', email: 'release@example.com' },
    });

    git.stage(['CHANGELOG.md', 'README.md', 'package.json']);
    git.commit({
      author: 'release-bot <release@example.com>',
      subject: 'chore(release): prepare 2026.2',
      body: '[skip ci]\n\nRelease-Notes: skip',
    });
    git.pushBranch('main');

    expect(transport.commands).toEqual([
      ['add', '--', 'CHANGELOG.md', 'README.md', 'package.json'],
      [
        'commit',
        '--author=release-bot <release@example.com>',
        '--message',
        'chore(release): prepare 2026.2',
        '--message',
        '[skip ci]\n\nRelease-Notes: skip',
      ],
      ['check-ref-format', '--branch', 'main'],
    ]);
    expect(transport.pushes).toEqual([['https://github.com/owner/repository.git', 'HEAD:refs/heads/main']]);
  });

  it('encapsulates read, fetch, branch, history, and squash commands', () => {
    const transport = new RecordingTransport([
      '',
      '',
      '',
      '',
      '',
      'git@github.com:owner/repository.git',
      'feat/coverage',
      'main\norigin/main\n\n',
      '',
      'head-sha',
      'commit-sha',
      '2026.2\n2026.1\n',
      'matching-sha',
      '',
      'one.ts\ntwo.ts\n',
      '',
      'log-output',
    ]);
    const git = new GitClient(transport);

    expect(git.isClean()).toBe(true);
    git.fetch();
    git.fetch('upstream', { prune: true, tags: true });
    git.fetchRef('origin', 'refs/pull/7/head', 'refs/remotes/origin/pr/7');
    git.fetchRef('origin', 'refs/pull/8/head', 'refs/remotes/origin/pr/8', true);
    expect(git.getRemoteUrl()).toBe('git@github.com:owner/repository.git');
    expect(git.getCurrentBranch()).toBe('feat/coverage');
    expect(git.listBranches()).toEqual(['main', 'origin/main']);
    git.createBranch('ci/quality-gates', 'origin/main');
    expect(git.resolve('HEAD')).toBe('head-sha');
    expect(git.commitFor('2026.2')).toBe('commit-sha');
    expect(git.listTags('20*', { pointsAt: 'HEAD', sort: '-version:refname', mergedInto: 'main' })).toEqual([
      '2026.2',
      '2026.1',
    ]);
    expect(git.findCommitByMessage('Source-PR: #7')).toBe('matching-sha');
    expect(git.findCommitByMessage('missing')).toBeUndefined();
    expect(git.changedFiles('main...HEAD')).toEqual(['one.ts', 'two.ts']);
    git.squashMerge('origin/pr/7');
    expect(git.log('2026.1..HEAD', '%H', true)).toBe('log-output');

    expect(transport.commands).toEqual([
      ['status', '--porcelain=v1'],
      ['fetch', 'origin'],
      ['fetch', '--prune', '--tags', 'upstream'],
      ['fetch', 'origin', 'refs/pull/7/head:refs/remotes/origin/pr/7'],
      ['fetch', '--force', 'origin', 'refs/pull/8/head:refs/remotes/origin/pr/8'],
      ['remote', 'get-url', 'origin'],
      ['branch', '--show-current'],
      ['branch', '--all', '--format=%(refname:short)'],
      ['switch', '--create', 'ci/quality-gates', 'origin/main'],
      ['rev-parse', 'HEAD'],
      ['rev-list', '-n', '1', '2026.2'],
      ['tag', '--points-at', 'HEAD', '--list', '20*', '--sort=-version:refname', '--merged', 'main'],
      ['log', '--fixed-strings', '--grep', 'Source-PR: #7', '-1', '--format=%H'],
      ['log', '--fixed-strings', '--grep', 'missing', '-1', '--format=%H'],
      ['diff', '--name-only', 'main...HEAD'],
      ['merge', '--squash', '--no-commit', 'origin/pr/7'],
      ['log', '--reverse', '--format=%H', '2026.1..HEAD'],
    ]);
  });

  it('validates branches, paths, tags, and ancestry before mutating Git', () => {
    const transport = new RecordingTransport([], [true, false, true, false, false]);
    const git = new GitClient(transport);

    expect(git.tagExists('2026.2')).toBe(true);
    expect(git.tagExists('missing')).toBe(false);
    expect(git.isAncestor('base', 'head')).toBe(true);
    expect(git.hasStagedChanges()).toBe(true);
    expect(() => git.stage([])).toThrow('не переданы файлы');
    expect(() => git.pushBranch('invalid branch')).toThrow('Некорректное имя');

    expect(transport.commands).toEqual([
      ['rev-parse', '--verify', 'refs/tags/2026.2'],
      ['rev-parse', '--verify', 'refs/tags/missing'],
      ['merge-base', '--is-ancestor', 'base', 'head'],
      ['diff', '--cached', '--quiet'],
      ['check-ref-format', '--branch', 'invalid branch'],
    ]);
  });
});

describe('GitCliTransport', () => {
  it('uses CommandExecutor and keeps the push token out of arguments', () => {
    vi.stubEnv('GIT_TRACE_CURL', '1');
    vi.stubEnv('GITHUB_TOKEN', 'raw-actions-token');
    const executor = {
      run: vi.fn(() => ''),
      succeeds: vi.fn(() => true),
    };
    const transport = new GitCliTransport(executor, { token: 'secret-token' });

    transport.push(['https://github.com/owner/repository.git', 'refs/tags/2026.2']);

    const [command, args, options] = executor.run.mock.calls[0];
    expect(command).toBe('git');
    expect(args).toEqual(['push', 'https://github.com/owner/repository.git', 'refs/tags/2026.2']);
    expect(args.join(' ')).not.toContain('secret-token');
    expect(options.env.GIT_CONFIG_VALUE_0).toMatch(/^AUTHORIZATION: basic /);
    expect(options.env.GIT_CONFIG_VALUE_0).not.toContain('secret-token');
    expect(options.env.GIT_TRACE_CURL).toBeUndefined();
    expect(options.env.GITHUB_TOKEN).toBeUndefined();
  });

  it('delegates ordinary commands and unauthenticated pushes with credential-safe environments', () => {
    const executor = {
      run: vi.fn(() => ' output '),
      succeeds: vi.fn(() => true),
    };
    const transport = new GitCliTransport(executor);

    expect(
      transport.execute(['status'], {
        env: { GH_DEBUG: 'api', GITHUB_TOKEN: 'token', SAFE_VALUE: 'visible' },
      }),
    ).toBe(' output ');
    expect(transport.succeeds(['rev-parse', 'HEAD'])).toBe(true);
    expect(transport.push(['origin', 'refs/tags/2026.2'])).toBe(' output ');

    expect(executor.run.mock.calls[0][2].env).toEqual(expect.objectContaining({ SAFE_VALUE: 'visible' }));
    expect(executor.run.mock.calls[0][2].env.GH_DEBUG).toBeUndefined();
    expect(executor.run.mock.calls[0][2].env.GITHUB_TOKEN).toBeUndefined();
    expect(executor.succeeds).toHaveBeenCalledWith(
      'git',
      ['rev-parse', 'HEAD'],
      expect.objectContaining({ env: expect.any(Object) }),
    );
    expect(executor.run.mock.calls[1][1]).toEqual(['push', 'origin', 'refs/tags/2026.2']);
  });
});

describe('GitClientFactory', () => {
  it('selects authenticated push only in Github Actions', () => {
    const transport = new RecordingTransport();
    const transports: GitTransportFactory = { create: vi.fn(() => transport) };

    const local = new GitClientFactory({}, transports).create();
    const actions = new GitClientFactory(
      { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'owner/repository', GITHUB_TOKEN: 'token' },
      transports,
    ).create();

    local.pushTag('local');
    actions.pushTag('actions');
    expect(transports.create).toHaveBeenNthCalledWith(1, undefined);
    expect(transports.create).toHaveBeenNthCalledWith(2, 'token');
    expect(transport.pushes).toEqual([
      ['origin', 'refs/tags/local'],
      ['https://github.com/owner/repository.git', 'refs/tags/actions'],
    ]);
  });

  it('uses origin without token authentication for the release deploy key', () => {
    const transport = new RecordingTransport();
    const transports: GitTransportFactory = { create: vi.fn(() => transport) };
    const actions = new GitClientFactory(
      { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'owner/repository', GITHUB_TOKEN: 'token' },
      transports,
    ).create({ useOriginForPush: true });

    actions.pushBranch('main');

    expect(transports.create).toHaveBeenCalledWith(undefined);
    expect(transport.pushes).toEqual([['origin', 'HEAD:refs/heads/main']]);
  });

  it('rejects incomplete Actions environments and can create the default local transport', () => {
    expect(() => new GitClientFactory({ GITHUB_ACTIONS: 'true' }).create()).toThrow('GITHUB_TOKEN');
    expect(() => new GitClientFactory({ GITHUB_ACTIONS: 'true', GITHUB_TOKEN: 'token' }).create()).toThrow(
      'GITHUB_REPOSITORY',
    );
    expect(new GitClientFactory({}).create()).toBeInstanceOf(GitClient);
  });
});

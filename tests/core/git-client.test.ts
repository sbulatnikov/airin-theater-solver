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

  constructor(private readonly outputs: string[] = []) {}

  execute(args: string[]): string {
    this.commands.push(args);
    return this.outputs.shift() ?? '';
  }

  succeeds(args: string[]): boolean {
    this.commands.push(args);
    return true;
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
      body: 'Release-Notes: skip',
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
        'Release-Notes: skip',
      ],
      ['check-ref-format', '--branch', 'main'],
    ]);
    expect(transport.pushes).toEqual([['https://github.com/owner/repository.git', 'HEAD:refs/heads/main']]);
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
});

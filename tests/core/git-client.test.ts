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
});

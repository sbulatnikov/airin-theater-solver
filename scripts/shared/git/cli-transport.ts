import { Buffer } from 'node:buffer';
import { type CommandExecutor, type CommandOptions, ProcessCommandExecutor } from '../command.ts';
import { environmentWithoutCredentialTracing } from '../safe-environment.ts';
import type { GitTransport } from './transport.ts';

interface GitPushAuthentication {
  token: string;
}

export class GitCliTransport implements GitTransport {
  constructor(
    private readonly executor: CommandExecutor = new ProcessCommandExecutor(),
    private readonly authentication?: GitPushAuthentication,
  ) {}

  execute(args: string[], options: CommandOptions = {}): string {
    return this.executor.run('git', args, { ...options, env: this.safeEnvironment(options.env) });
  }

  succeeds(args: string[], options: CommandOptions = {}): boolean {
    return this.executor.succeeds('git', args, { ...options, env: this.safeEnvironment(options.env) });
  }

  push(args: string[]): string {
    if (!this.authentication) return this.execute(['push', ...args]);

    const basic = Buffer.from(`x-access-token:${this.authentication.token}`, 'utf8').toString('base64');
    return this.execute(['push', ...args], {
      env: {
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
        GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
      },
    });
  }

  private safeEnvironment(additions: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    const environment = environmentWithoutCredentialTracing(additions);
    delete environment.GITHUB_TOKEN;
    delete environment.GH_TOKEN;
    delete environment.REPOSITORY_ADMIN_TOKEN;
    return environment;
  }
}

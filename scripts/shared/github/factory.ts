import { GitClientFactory } from '../git.ts';
import { GithubApiTransport } from './api-transport.ts';
import { GithubCliTransport } from './cli-transport.ts';
import { GithubClient } from './client.ts';
import { parseGithubRepository } from './repository.ts';
import type { GithubTransport } from './transport.ts';

export interface GithubClientOptions {
  repository?: string;
  token?: string;
}

export interface GithubTransportFactory {
  createApi(token: string): GithubTransport;
  createCli(token?: string): GithubTransport;
}

export class DefaultGithubTransportFactory implements GithubTransportFactory {
  createApi(token: string): GithubTransport {
    return new GithubApiTransport(token);
  }

  createCli(token?: string): GithubTransport {
    return new GithubCliTransport(token);
  }
}

export class GithubClientFactory {
  constructor(
    private readonly environment: NodeJS.ProcessEnv = process.env,
    private readonly originResolver: () => string = () =>
      new GitClientFactory(this.environment).create().getRemoteUrl(),
    private readonly transports: GithubTransportFactory = new DefaultGithubTransportFactory(),
  ) {}

  create(options: GithubClientOptions = {}): GithubClient {
    const actions = this.environment.GITHUB_ACTIONS === 'true';
    const token = options.token ?? (actions ? this.environment.GITHUB_TOKEN : this.environment.GH_TOKEN);
    const repository =
      options.repository ?? this.environment.GITHUB_REPOSITORY ?? parseGithubRepository(this.originResolver());

    const transport = (() => {
      if (!actions) return this.transports.createCli(token);
      if (!token) throw new Error('В Github Actions отсутствует обязательный GITHUB_TOKEN.');
      return this.transports.createApi(token);
    })();
    return new GithubClient(repository, transport);
  }
}

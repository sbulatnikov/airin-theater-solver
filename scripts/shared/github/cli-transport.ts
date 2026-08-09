import { type CommandExecutor, ProcessCommandExecutor } from '../command.ts';
import { environmentWithoutCredentialTracing } from '../safe-environment.ts';
import type { GithubRequest, GithubTransport } from './transport.ts';

export class GithubCliTransport implements GithubTransport {
  constructor(
    private readonly token?: string,
    private readonly executor: CommandExecutor = new ProcessCommandExecutor(),
  ) {}

  async execute<T>({ method, path, body }: GithubRequest): Promise<T> {
    const input = body === undefined ? undefined : JSON.stringify(body);
    const args = ['api', '--method', method, path.replace(/^\//, '')];
    if (input !== undefined) args.push('--input', '-');

    try {
      const environment = environmentWithoutCredentialTracing();
      delete environment.GITHUB_TOKEN;
      delete environment.GH_TOKEN;
      delete environment.REPOSITORY_ADMIN_TOKEN;
      if (this.token) environment.GH_TOKEN = this.token;
      const output = this.executor.run('gh', args, {
        env: environment,
        input,
      });
      return (output ? JSON.parse(output) : undefined) as T;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const hint = this.token ? '' : ' Локальный запуск требует `gh auth login`.';
      throw new Error(`Github CLI ${method} ${path} завершился ошибкой.${hint} ${detail}`);
    }
  }
}

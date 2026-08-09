import { spawnSync } from 'node:child_process';
import { redactCredentials } from './safe-environment.ts';

export interface CommandOptions {
  env?: NodeJS.ProcessEnv;
  input?: string;
}

export interface CommandExecutor {
  run(command: string, args: string[], options?: CommandOptions): string;
  succeeds(command: string, args: string[], options?: CommandOptions): boolean;
}

export class ProcessCommandExecutor implements CommandExecutor {
  run(command: string, args: string[], options: CommandOptions = {}): string {
    const result = this.execute(command, args, options);
    const environment = options.env ?? process.env;
    if (result.error) {
      throw new Error(redactCredentials(`Не удалось запустить ${command}: ${result.error.message}`, environment));
    }
    if (result.status !== 0) {
      const message = `${command} ${args.join(' ')} завершился с кодом ${result.status}: ${result.stderr.trim()}`;
      throw new Error(redactCredentials(message, environment));
    }
    return result.stdout.trim();
  }

  succeeds(command: string, args: string[], options: CommandOptions = {}): boolean {
    return this.execute(command, args, options).status === 0;
  }

  private execute(command: string, args: string[], options: CommandOptions) {
    return spawnSync(command, args, {
      encoding: 'utf8',
      env: options.env ?? process.env,
      input: options.input,
      stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
  }
}

export function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Обязательная переменная окружения не задана: ${name}.`);
  return value;
}

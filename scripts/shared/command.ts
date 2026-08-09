import { spawnSync } from "node:child_process";

interface CommandOptions {
  env?: NodeJS.ProcessEnv;
  input?: string;
}

function execute(command: string, args: string[], options: CommandOptions = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    env: options.env ?? process.env,
    input: options.input,
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
  });
}

export function run(command: string, args: string[], options: CommandOptions = {}): string {
  const result = execute(command, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} завершился с кодом ${result.status}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

export function succeeds(command: string, args: string[]): boolean {
  return execute(command, args).status === 0;
}

export function gh(args: string[], token: string, input?: string): string {
  return run("gh", args, { env: { ...process.env, GH_TOKEN: token }, input });
}

export function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Обязательная переменная окружения не задана: ${name}.`);
  return value;
}

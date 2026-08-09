import type { CommandOptions } from '../command.ts';

export interface GitTransport {
  execute(args: string[], options?: CommandOptions): string;
  succeeds(args: string[], options?: CommandOptions): boolean;
  push(args: string[]): string;
}

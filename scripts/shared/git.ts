export { GitCliTransport } from './git/cli-transport.ts';
export {
  GitClient,
  type GitClientConfig,
  type GitCommitOptions,
  type GitIdentity,
  type GitTagQuery,
} from './git/client.ts';
export {
  DefaultGitTransportFactory,
  GitClientFactory,
  type GitClientOptions,
  type GitTransportFactory,
} from './git/factory.ts';
export type { GitTransport } from './git/transport.ts';

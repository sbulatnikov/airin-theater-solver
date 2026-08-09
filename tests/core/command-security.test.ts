import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProcessCommandExecutor, requireEnvironment } from '../../scripts/shared/command.ts';
import { environmentWithoutCredentialTracing, redactCredentials } from '../../scripts/shared/safe-environment.ts';

describe('credential-safe command execution', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('redacts credentials from process errors', () => {
    const executor = new ProcessCommandExecutor();
    const token = 'test-sensitive-value';

    expect(() =>
      executor.run(process.execPath, ['-e', 'console.error(process.env.TEST_TOKEN); process.exit(1)'], {
        env: { ...process.env, TEST_TOKEN: token },
      }),
    ).toThrow('[REDACTED]');

    try {
      executor.run(process.execPath, ['-e', 'console.error(process.env.TEST_TOKEN); process.exit(1)'], {
        env: { ...process.env, TEST_TOKEN: token },
      });
    } catch (error) {
      expect(String(error)).not.toContain(token);
    }
  });

  it('returns trimmed output, reports success, and validates required environment variables', () => {
    const executor = new ProcessCommandExecutor();

    expect(executor.run(process.execPath, ['-e', 'process.stdout.write(" result ")'])).toBe('result');
    expect(executor.succeeds(process.execPath, ['-e', 'process.exit(0)'])).toBe(true);
    expect(executor.succeeds(process.execPath, ['-e', 'process.exit(2)'])).toBe(false);

    vi.stubEnv('REQUIRED_FIXTURE', 'present');
    expect(requireEnvironment('REQUIRED_FIXTURE')).toBe('present');
    vi.stubEnv('REQUIRED_FIXTURE', '');
    expect(() => requireEnvironment('REQUIRED_FIXTURE')).toThrow('Обязательная переменная');
  });

  it('removes credential tracing flags and redacts authorization headers', () => {
    const environment = environmentWithoutCredentialTracing({
      GH_DEBUG: 'api',
      GIT_TRACE_CURL: '1',
      SAFE_VALUE: 'visible',
    });

    expect(environment.GH_DEBUG).toBeUndefined();
    expect(environment.GIT_TRACE_CURL).toBeUndefined();
    expect(environment.SAFE_VALUE).toBe('visible');
    expect(redactCredentials('Authorization: Bearer abcdef123456')).toBe('Authorization: Bearer [REDACTED]');
    expect(
      redactCredentials('failed with YWJjZGVmMTIzNDU2', {
        GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic YWJjZGVmMTIzNDU2',
      }),
    ).toBe('failed with [REDACTED]');
  });
});

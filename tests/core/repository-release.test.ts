import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setRepositoryRelease } from '../../scripts/repository-release.ts';
import { releaseForTag, verifyReleaseTag } from '../../scripts/verify-release-tag.ts';

const temporaryDirectories: string[] = [];

async function repository(readme = 'Релиз репозитория: **2026.2**\n'): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'airin-release-test-'));
  temporaryDirectories.push(root);
  await writeFile(join(root, 'package.json'), '{"name":"fixture","version":"2026.2.0"}\n', 'utf8');
  await writeFile(join(root, 'README.md'), readme, 'utf8');
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('repository release files', () => {
  it('updates package.json and the documented repository release atomically', async () => {
    const root = await repository();

    await setRepositoryRelease('2026.3', root);

    expect(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version).toBe('2026.3.0');
    await expect(readFile(join(root, 'README.md'), 'utf8')).resolves.toContain('Релиз репозитория: **2026.3**');
  });

  it('rejects malformed releases and README files without the release marker', async () => {
    await expect(setRepositoryRelease('invalid', await repository())).rejects.toThrow('стабильная версия');
    await expect(setRepositoryRelease('2026.3', await repository('# Missing marker\n'))).rejects.toThrow(
      'В README не найдена версия',
    );
  });
});

describe('release tag verification', () => {
  it('accepts stable and next-feature candidate tags that match package.json', async () => {
    expect(releaseForTag('2026.2', '2026.2.0')).toBe('2026.2');
    expect(releaseForTag('2026.1-rc.2', '2026.2.0')).toBe('2026.2');
    await expect(verifyReleaseTag('2026.2')).resolves.toBe('2026.2');
  });

  it('rejects invalid, stale, and mismatched tags without leaking ambiguous state', () => {
    expect(() => releaseForTag('', '2026.2.0')).toThrow('Некорректный релизный тег');
    expect(() => releaseForTag('2026.2-rc.1', '2026.2.0')).toThrow('Некорректный релизный тег');
    expect(() => releaseForTag('2026.3', '2026.2.0')).toThrow('должен выпускать 2026.3');
    expect(() => releaseForTag('2026.2', 'invalid')).toThrow('package.json');
  });
});

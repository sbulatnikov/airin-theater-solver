import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');

function contentHashes(html: string, element: string): string[] {
  const matches = html.matchAll(new RegExp(`<${element}\\b[^>]*>([\\s\\S]*?)<\\/${element}>`, 'gi'));
  return [...matches].map((match) => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`);
}

function applyContentSecurityPolicy(html: string, variant: string): string {
  const scriptHashes = contentHashes(html, 'script');
  const styleHashes = contentHashes(html, 'style');
  if (scriptHashes.length === 0 || styleHashes.length === 0) {
    throw new Error(`Сборка ${variant} не содержит ожидаемые встроенные script и style.`);
  }
  const policy = [
    "default-src 'none'",
    `script-src ${scriptHashes.join(' ')}`,
    `style-src ${styleHashes.join(' ')} https://fonts.googleapis.com`,
    'font-src https://fonts.gstatic.com',
    'img-src data:',
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  if (!html.includes('__AIRIN_CSP__')) throw new Error(`Сборка ${variant} не содержит CSP placeholder.`);
  return html.replace('__AIRIN_CSP__', policy);
}

const v2Html = applyContentSecurityPolicy(await readFile(resolve(root, '.build/v2/index.html'), 'utf8'), 'v2');
const v2Version = JSON.parse(await readFile(resolve(root, 'apps/v2/package.json'), 'utf8')).version;

if (!v2Html.includes(v2Version)) {
  throw new Error('Сборка v2 не содержит версию приложения.');
}

function verifySingleFile(html: string, variant: string): void {
  const forbiddenPatterns: Array<[RegExp, string]> = [
    [/<script\b[^>]*\bsrc\s*=/i, 'внешний script'],
    [/sourceMappingURL=/i, 'ссылку на sourcemap'],
    [/\/src\/main\.ts/i, 'ссылку на исходный entrypoint'],
  ];
  for (const [pattern, description] of forbiddenPatterns) {
    if (pattern.test(html)) throw new Error(`Сборка ${variant} содержит ${description}.`);
  }
  const stylesheetLinks = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)];
  if (stylesheetLinks.some(([link]) => !/href=["']https:\/\/fonts\.googleapis\.com\/css2\?/i.test(link))) {
    throw new Error(`Сборка ${variant} содержит непредусмотренный внешний stylesheet.`);
  }
  if (!html.includes('http-equiv="Content-Security-Policy"')) {
    throw new Error(`Сборка ${variant} не содержит Content Security Policy.`);
  }
  if (html.includes('__AIRIN_CSP__') || html.includes("'unsafe-inline'")) {
    throw new Error(`Сборка ${variant} содержит небезопасную или незавершённую Content Security Policy.`);
  }
  if (!html.includes('<meta name="referrer" content="no-referrer">')) {
    throw new Error(`Сборка ${variant} не отключает передачу Referrer.`);
  }
  if (
    !html.includes('<meta name="color-scheme" content="light dark">') ||
    !html.includes('<meta name="theme-color"') ||
    !html.includes('airin-play-theme')
  ) {
    throw new Error(`Сборка ${variant} не содержит полную настройку цветовой темы.`);
  }
}
verifySingleFile(v2Html, 'v2');

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'v2'), { recursive: true });
await writeFile(resolve(dist, 'v2/index.html'), v2Html, 'utf8');
await writeFile(resolve(dist, '.nojekyll'), '', 'utf8');
await writeFile(
  resolve(dist, 'index.html'),
  `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="referrer" content="no-referrer">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; base-uri 'none'; form-action 'none'">
    <meta http-equiv="refresh" content="0; url=./v2/">
    <title>Суфлёр</title>
  </head>
  <body><p><a href="./v2/">Открыть актуальную версию Суфлёра</a></p></body>
</html>
`,
  'utf8',
);

console.log('Собрано: dist/index.html и dist/v2/index.html');

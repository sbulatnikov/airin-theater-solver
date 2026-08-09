import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '../dist');
const host = '127.0.0.1';
const port = 4173;
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function resolveRequestPath(rawUrl: string | undefined): string | null {
  const url = new URL(rawUrl ?? '/', `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath.endsWith('/') ? `${decodedPath}index.html` : decodedPath;
  const filePath = resolve(root, `.${relativePath}`);
  return filePath === root || filePath.startsWith(`${root}${sep}`) ? filePath : null;
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  try {
    const filePath = resolveRequestPath(request.url);
    if (!filePath || !(await stat(filePath)).isFile()) {
      response.writeHead(404).end('Not found');
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    const status = error instanceof URIError ? 400 : 404;
    response.writeHead(status).end(status === 400 ? 'Bad request' : 'Not found');
  }
});

server.listen(port, host, () => {
  console.log(`E2E server: http://${host}:${port}`);
});

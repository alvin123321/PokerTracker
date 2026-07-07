import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const snapshotPath = join(root, 'public', 'snapshots', 'production-copy.json');
const statePath = join(root, '.local', 'shared-state.json');
const port = Number(process.env.PORT ?? 4300);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}

async function loadState() {
  try {
    return await readJson(statePath);
  } catch {
    const snapshot = await readJson(snapshotPath);
    const state = {
      sessions: snapshot.sessions ?? [],
      registeredPlayers: snapshot.registeredPlayers ?? [],
      deletedRegisteredPlayerIds: []
    };
    await writeJson(statePath, state);
    return state;
  }
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function send(response, status, data) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  });
  response.end(JSON.stringify(data));
}

createServer(async (request, response) => {
  try {
    if (request.method === 'OPTIONS') {
      send(response, 204, {});
      return;
    }

    if (request.url === '/state' && request.method === 'GET') {
      send(response, 200, await loadState());
      return;
    }

    if (request.url === '/state' && request.method === 'PATCH') {
      const state = await loadState();
      const patch = JSON.parse((await readBody(request)) || '{}');
      const nextState = {
        ...state,
        ...(Array.isArray(patch.sessions) ? { sessions: patch.sessions } : {}),
        ...(Array.isArray(patch.registeredPlayers)
          ? { registeredPlayers: patch.registeredPlayers }
          : {}),
        ...(Array.isArray(patch.deletedRegisteredPlayerIds)
          ? { deletedRegisteredPlayerIds: patch.deletedRegisteredPlayerIds }
          : {})
      };
      await writeJson(statePath, nextState);
      send(response, 200, nextState);
      return;
    }

    send(response, 404, { error: 'Not found' });
  } catch (error) {
    send(response, 500, { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Local shared PokerTrack data server running on http://0.0.0.0:${port}`);
});

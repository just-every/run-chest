import { resolve } from 'node:path';
import { startServer } from './server/runtime.mjs';
import { ServerConfigurationError } from './server/settings.mjs';

const root = resolve(import.meta.dirname, '..');
process.chdir(root);
const controller = new AbortController();
const stop = () => controller.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  await startServer(root, process.argv.slice(2), controller.signal);
} catch (error) {
  const message = error instanceof ServerConfigurationError ? error.message
    : error.code === 'LOCAL_OPERATION_BUSY' ? 'This installation is already in use. Stop its serving or setup process before starting the server.'
    : error.code === 'EADDRINUSE' ? 'The server port is occupied. Choose another CHEST_SERVER_PORT.'
    : 'Server startup or serving failed. Check the production build, private settings and available local storage.';
  console.error(message);
  process.exitCode = 1;
} finally {
  process.off('SIGINT', stop);
  process.off('SIGTERM', stop);
}

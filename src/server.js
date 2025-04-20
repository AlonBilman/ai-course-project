import app from './app.js';
import http from 'http'; // Import the built-in http module
import { fileURLToPath } from 'url'; // Import url helper
import { resolve } from 'path'; // Import path helper

let server; // Variable to hold the server instance

/**
 * Starts the Express server.
 * @param {number} [port=3000] - The port to listen on. Defaults to 3000 or process.env.PORT.
 * @returns {Promise<{ baseURL: string, server: http.Server }>} A promise that resolves with the base URL and server instance once the server is listening.
 */
export function start(port = process.env.PORT || 3000) {
  return new Promise((resolve, reject) => {
    if (server && server.listening) {
      console.warn(`Server is already running on port ${server.address().port}`);
      // Optionally resolve with existing info or reject, depending on desired behavior
      // For E2E tests, resolving might be okay if the same instance is reused.
      const address = server.address();
      const baseURL = `http://localhost:${address.port}`;
      resolve({ baseURL, server });
      return;
    }

    server = http.createServer(app); // Create server with the Express app

    server.listen(port, () => {
      const address = server.address();
      const baseURL = `http://localhost:${address.port}`;
      console.log(`Server listening on ${baseURL}`);
      resolve({ baseURL, server }); // Resolve with baseURL and the server instance
    });

    server.on('error', (error) => {
      console.error('Error starting server:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use.`);
      }
      reject(error); // Reject the promise on error
    });
  });
}

/**
 * Stops the currently running Express server.
 * @returns {Promise<void>} A promise that resolves once the server is closed.
 */
export function stop() {
  return new Promise((resolve, reject) => {
    if (!server || !server.listening) {
      console.warn('Server is not running or already stopped.');
      resolve(); // Resolve immediately if server isn't running
      return;
    }

    server.close((error) => {
      if (error) {
        console.error('Error stopping server:', error);
        reject(error); // Reject the promise on error
      } else {
        console.log('Server stopped.');
        server = null; // Clear the server variable
        resolve(); // Resolve successfully
      }
    });
  });
}

// Optional: Allow running the server directly using `node src/server.js`
// This checks if the module is the main module being run.
// Correctly compare file paths, accounting for different OS formats and URL encoding.
const __filename = fileURLToPath(import.meta.url);
const mainScript = resolve(process.argv[1]);

if (__filename === mainScript) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

  // Graceful shutdown handling
  process.on('SIGINT', async () => {
    console.log('SIGINT signal received: closing HTTP server');
    await stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing HTTP server');
    await stop();
    process.exit(0);
  });
}

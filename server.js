/* Mokuroku server: serves the app and stores posters, the library and PNG exports on disk.
 * Start it with start.bat (or `node server.js`). The rest of the server is in server/.
 */

const http = require("http");
const { handleApiRequest } = require("./server/api");
const { HOST, PORT } = require("./server/config");
const { httpError, sendResponse } = require("./server/httpHelpers");
const { serveAppFile } = require("./server/staticFiles");

/**
 * Handles every request: /api/... addresses go to the API, everything else is a file.
 * Any error is answered as JSON { error }; unexpected ones are also logged.
 * @param {http.IncomingMessage} request
 * @param {http.ServerResponse} response
 */
async function handleRequest(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      return await handleApiRequest(request, response, url);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      throw httpError(405, "Method not allowed");
    }
    await serveAppFile(response, url);
  } catch (error) {
    if (!error.status) console.error(error);
    sendResponse(response, error.status || 500, { error: error.message });
  }
}

http.createServer(handleRequest).listen(PORT, HOST, () => {
  console.log(`Mokuroku running at http://${HOST}:${PORT}`);
  console.log("Press Ctrl+C to stop.");
});

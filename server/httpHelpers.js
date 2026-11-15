// Errors, responses and reading uploads
const { MAX_UPLOAD_SIZE } = require("./config");

/**
 * Creates an error that is sent to the browser with the given HTTP status.
 * @param {number} status - e.g. 400, 404
 * @param {string} message - shown to the user
 * @returns {Error & { status: number }}
 */
function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/**
 * Sends a response. Objects are sent as JSON; text and binary data as they are.
 * @param {import("http").ServerResponse} response
 * @param {number} status
 * @param {object | string | Buffer} body
 * @param {string} [contentType]
 */
function sendResponse(
  response,
  status,
  body,
  contentType = "application/json",
) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  const isRawData = Buffer.isBuffer(body) || typeof body === "string";
  response.end(isRawData ? body : JSON.stringify(body));
}

/**
 * Answers { ok: true }, plus any extra fields.
 * @param {import("http").ServerResponse} response
 * @param {object} [extraFields]
 */
function sendOk(response, extraFields = {}) {
  sendResponse(response, 200, { ok: true, ...extraFields });
}

/**
 * Reads the whole uploaded body of a request.
 * @param {import("http").IncomingMessage} request
 * @param {number} [maxSize] - in bytes
 * @returns {Promise<Buffer>}
 * @throws a 413 error if the body is larger than maxSize
 */
function readRequestBody(request, maxSize = MAX_UPLOAD_SIZE) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        reject(httpError(413, "File too large"));
        request.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

module.exports = { httpError, sendResponse, sendOk, readRequestBody };

// Serving the app's own files (index.html, js/, style.css, poster images…)
const fs = require("fs/promises");
const path = require("path");
const { APP_FOLDER, CONTENT_TYPES } = require("./config");
const { httpError, sendResponse } = require("./httpHelpers");

/**
 * Sends a file from the app folder. Refuses paths that would reach outside it.
 * @param {import("http").ServerResponse} response
 * @param {URL} url
 * @throws a 403 error for paths outside the app folder, 404 if the file doesn't exist
 */
async function serveAppFile(response, url) {
  const relativePath = decodeURIComponent(
    url.pathname === "/" ? "/index.html" : url.pathname,
  );
  const file = path.normalize(path.join(APP_FOLDER, relativePath));
  if (!file.startsWith(APP_FOLDER + path.sep))
    throw httpError(403, "Forbidden");

  let contents;
  try {
    contents = await fs.readFile(file);
  } catch {
    throw httpError(404, "Not found");
  }
  const contentType =
    CONTENT_TYPES[path.extname(file).toLowerCase()] ||
    "application/octet-stream";
  sendResponse(response, 200, contents, contentType);
}

module.exports = { serveAppFile };

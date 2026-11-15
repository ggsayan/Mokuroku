// The list of API routes, and running the right one for each /api/... request
const { httpError } = require("./httpHelpers");
const categoryFolders = require("./routes/categoryFolders");
const { saveExport } = require("./routes/exports");
const { downloadImage } = require("./routes/imageDownload");
const library = require("./routes/library");
const posters = require("./routes/posters");
const trash = require("./routes/trash");

/* Each route receives { request, response, query }, where query holds the
 * ?key=value parameters of the address.
 */
const API_ROUTES = {
  "GET /api/library": library.getLibrary,
  "PUT /api/library": library.saveLibrary,
  "POST /api/folder": categoryFolders.createCategoryFolder,
  "DELETE /api/folder": categoryFolders.trashCategoryFolder,
  "POST /api/folder/restore": categoryFolders.restoreCategoryFolder,
  "POST /api/folder/rename": categoryFolders.renameCategoryFolder,
  "PUT /api/poster": posters.savePoster,
  "DELETE /api/poster": posters.trashPoster,
  "POST /api/poster/restore": posters.restorePoster,
  "POST /api/poster/move": posters.movePoster,
  "POST /api/fetch": downloadImage,
  "PUT /api/export": saveExport,
  "GET /api/trash": trash.listTrash,
  "DELETE /api/trash/poster": trash.deleteTrashedPoster,
  "DELETE /api/trash/category": trash.deleteTrashedCategory,
};

/**
 * Runs the API route matching the request's method and address.
 * Every request that changes something must carry the X-Mokuroku header. Browsers
 * won't let another website send it without asking first, so other sites can't
 * change your files.
 * @param {import("http").IncomingMessage} request
 * @param {import("http").ServerResponse} response
 * @param {URL} url
 * @throws a 403 error without the header, 404 for an unknown route
 */
async function handleApiRequest(request, response, url) {
  if (request.method !== "GET" && request.headers["x-mokuroku"] !== "1") {
    throw httpError(403, "Forbidden");
  }
  const route = API_ROUTES[`${request.method} ${url.pathname}`];
  if (!route) throw httpError(404, "Unknown API route");
  await route({
    request,
    response,
    query: Object.fromEntries(url.searchParams),
  });
}

module.exports = { handleApiRequest };

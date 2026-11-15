// API route that saves PNG exports
const fs = require("fs/promises");
const path = require("path");
const { EXPORTS_FOLDER, MAX_EXPORT_SIZE } = require("../config");
const { httpError, readRequestBody, sendOk } = require("../httpHelpers");
const { isSafeName } = require("../paths");

/** PUT /api/export?file= — saves an uploaded PNG into exports/. Answers { path: <where it was saved> }. */
async function saveExport({ request, response, query }) {
  if (!isSafeName(query.file) || !/\.png$/i.test(query.file)) {
    throw httpError(400, "Invalid file name");
  }
  await fs.mkdir(EXPORTS_FOLDER, { recursive: true });
  const file = path.join(EXPORTS_FOLDER, query.file);
  await fs.writeFile(file, await readRequestBody(request, MAX_EXPORT_SIZE));
  sendOk(response, { path: file });
}

module.exports = { saveExport };

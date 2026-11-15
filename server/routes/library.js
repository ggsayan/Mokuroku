// API routes for library.json
const fs = require("fs/promises");
const { LIBRARY_FILE, POSTERS_FOLDER } = require("../config");
const { listPosterFilesOnDisk } = require("../files");
const { readRequestBody, sendOk, sendResponse } = require("../httpHelpers");

/**
 * GET /api/library — answers { library, disk }: the saved library.json (null if
 * there is none yet) and the image files actually found in each folder.
 */
async function getLibrary({ response }) {
  let library = null;
  try {
    library = JSON.parse(await fs.readFile(LIBRARY_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  sendResponse(response, 200, { library, disk: await listPosterFilesOnDisk() });
}

/**
 * PUT /api/library — saves the uploaded JSON as library.json. It is written to a
 * temporary file first, so a crash can never leave a half-written library.
 */
async function saveLibrary({ request, response }) {
  const body = await readRequestBody(request);
  JSON.parse(body); // refuse anything that isn't valid JSON
  await fs.mkdir(POSTERS_FOLDER, { recursive: true });
  const temporaryFile = LIBRARY_FILE + ".tmp";
  await fs.writeFile(temporaryFile, body);
  await fs.rename(temporaryFile, LIBRARY_FILE);
  sendOk(response);
}

module.exports = { getLibrary, saveLibrary };

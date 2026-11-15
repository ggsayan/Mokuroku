// API routes for poster images: save, move to the trash, restore, move to another category
const fs = require("fs/promises");
const path = require("path");
const {
  moveTo,
  pathExists,
  removeFolderIfEmpty,
  timestamp,
} = require("../files");
const { httpError, readRequestBody, sendOk } = require("../httpHelpers");
const {
  posterFilePath,
  requirePosterFileName,
  trashedPosterPath,
} = require("../paths");

/** PUT /api/poster?folder=&file= — saves the uploaded image as a poster. */
async function savePoster({ request, response, query }) {
  const file = posterFilePath(query.folder, query.file);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, await readRequestBody(request));
  sendOk(response);
}

/** DELETE /api/poster?folder=&file= — moves a poster to the trash (fine if it is already gone). */
async function trashPoster({ response, query }) {
  const from = posterFilePath(query.folder, query.file);
  const to = trashedPosterPath(query.folder, query.file);
  if (await pathExists(from)) await moveTo(from, to);
  sendOk(response);
}

/**
 * POST /api/poster/restore?folder=&file=&to= — moves a trashed poster back.
 * folder is the category it was removed from; to is the category to restore it into.
 */
async function restorePoster({ response, query }) {
  const from = trashedPosterPath(query.folder, query.file);
  const to = posterFilePath(query.to, query.file);
  if (!(await pathExists(from))) throw httpError(404, "Not in trash any more");
  if (await pathExists(to)) {
    throw httpError(409, "A poster with that name already exists");
  }
  await moveTo(from, to);
  await removeFolderIfEmpty(path.dirname(from));
  sendOk(response);
}

/**
 * POST /api/poster/move?folder=&file=&to= — moves a poster to another category.
 * If that category already has a file with the same name, the poster is renamed.
 * Answers { file: <its file name now> }.
 */
async function movePoster({ response, query }) {
  const from = posterFilePath(query.folder, query.file);
  let newName = requirePosterFileName(query.file);
  if (await pathExists(posterFilePath(query.to, newName))) {
    newName = `${timestamp()}-${newName}`;
  }
  await moveTo(from, posterFilePath(query.to, newName));
  sendOk(response, { file: newName });
}

module.exports = { savePoster, trashPoster, restorePoster, movePoster };

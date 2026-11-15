// API routes for the trash: list what is in it, and delete things for good.
// Restoring uses the existing /api/poster/restore and /api/folder/restore routes.
const fs = require("fs/promises");
const path = require("path");
const { CATEGORY_TRASH_FOLDER, TRASH_FOLDER } = require("../config");
const {
  listImageFiles,
  listSubfolders,
  removeFolderIfEmpty,
} = require("../files");
const { httpError, sendOk, sendResponse } = require("../httpHelpers");
const { isSafeName, trashedPosterPath } = require("../paths");

/**
 * GET /api/trash — answers { posters, categories }:
 * - posters: [{ folder, file }] — posters removed one by one, with the folder they came from
 * - categories: [{ trashed, folder, removedAt, files }] — removed categories, newest first.
 *   trashed is the name in the trash, removedAt a time in milliseconds (or null).
 */
async function listTrash({ response }) {
  const posters = [];
  for (const folder of await listSubfolders(TRASH_FOLDER)) {
    if (folder.startsWith(".")) continue; // .categories is listed below
    for (const file of await listImageFiles(path.join(TRASH_FOLDER, folder))) {
      posters.push({ folder, file });
    }
  }

  const categories = [];
  for (const trashed of await listSubfolders(CATEGORY_TRASH_FOLDER)) {
    // Names look like "<time in base 36>-<folder>"
    const [stamp, ...folderParts] = trashed.split("-");
    categories.push({
      trashed,
      folder: folderParts.join("-") || trashed,
      removedAt: parseInt(stamp, 36) || null,
      files: await listImageFiles(path.join(CATEGORY_TRASH_FOLDER, trashed)),
    });
  }
  categories.sort((a, b) => (b.removedAt ?? 0) - (a.removedAt ?? 0));

  sendResponse(response, 200, { posters, categories });
}

/** DELETE /api/trash/poster?folder=&file= — deletes a removed poster for good. */
async function deleteTrashedPoster({ response, query }) {
  const file = trashedPosterPath(query.folder, query.file);
  await fs.rm(file, { force: true });
  await removeFolderIfEmpty(path.dirname(file));
  sendOk(response);
}

/** DELETE /api/trash/category?trashed= — deletes a removed category and its posters for good. */
async function deleteTrashedCategory({ response, query }) {
  if (!isSafeName(query.trashed)) throw httpError(400, "Invalid trash name");
  await fs.rm(path.join(CATEGORY_TRASH_FOLDER, query.trashed), {
    recursive: true,
    force: true,
  });
  sendOk(response);
}

module.exports = {
  listTrash,
  deleteTrashedPoster,
  deleteTrashedCategory,
};

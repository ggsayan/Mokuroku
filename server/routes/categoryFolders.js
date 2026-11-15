// API routes for category folders: create, move to the trash, restore
const fs = require("fs/promises");
const path = require("path");
const { CATEGORY_TRASH_FOLDER } = require("../config");
const { moveTo, pathExists, timestamp } = require("../files");
const { httpError, sendOk } = require("../httpHelpers");
const { categoryFolderPath, isSafeName, requireFolderName } = require("../paths");

/** POST /api/folder?folder= — creates a category folder (fine if it already exists). */
async function createCategoryFolder({ response, query }) {
  await fs.mkdir(categoryFolderPath(query.folder), { recursive: true });
  sendOk(response);
}

/**
 * DELETE /api/folder?folder= — moves a category folder to the trash.
 * Answers { trashed: <its name in the trash> }, or trashed: null if the folder didn't exist.
 */
async function trashCategoryFolder({ response, query }) {
  const folder = requireFolderName(query.folder);
  const from = categoryFolderPath(folder);
  if (!(await pathExists(from))) return sendOk(response, { trashed: null });

  const trashedName = `${timestamp()}-${folder}`;
  await moveTo(from, path.join(CATEGORY_TRASH_FOLDER, trashedName));
  sendOk(response, { trashed: trashedName });
}

/**
 * POST /api/folder/restore?trashed=&folder= — moves a trashed category folder back.
 * trashed is the name given by trashCategoryFolder; folder is the name to restore it as.
 */
async function restoreCategoryFolder({ response, query }) {
  if (!isSafeName(query.trashed)) throw httpError(400, "Invalid trash name");
  const from = path.join(CATEGORY_TRASH_FOLDER, query.trashed);
  const to = categoryFolderPath(query.folder);
  if (!(await pathExists(from))) throw httpError(404, "Not in trash any more");
  if (await pathExists(to)) {
    throw httpError(409, "A folder with that name already exists");
  }
  await moveTo(from, to);
  sendOk(response);
}

/**
 * POST /api/folder/rename?folder=&to= — renames a category folder.
 * Changing only upper/lower case is allowed. If the folder doesn't exist,
 * it is created under the new name.
 */
async function renameCategoryFolder({ response, query }) {
  const from = categoryFolderPath(query.folder);
  const to = categoryFolderPath(query.to);
  const isCaseChangeOnly = query.folder.toLowerCase() === query.to.toLowerCase();
  if (!isCaseChangeOnly && (await pathExists(to))) {
    throw httpError(409, "A folder with that name already exists");
  }
  if (await pathExists(from)) await fs.rename(from, to);
  else await fs.mkdir(to, { recursive: true });
  sendOk(response);
}

module.exports = {
  createCategoryFolder,
  trashCategoryFolder,
  restoreCategoryFolder,
  renameCategoryFolder,
};

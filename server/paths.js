// Checking folder and file names sent by the browser, and turning them into paths on disk
const path = require("path");
const {
  POSTERS_FOLDER,
  TRASH_FOLDER,
  POSTER_FILE_PATTERN,
} = require("./config");
const { httpError } = require("./httpHelpers");

/**
 * Whether a folder or file name is safe to use: not empty, not too long, no
 * characters Windows forbids, and not "." or ".." (which could escape the folder).
 * @param {unknown} name
 * @returns {boolean}
 */
function isSafeName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length < 200 &&
    !/[<>:"/\\|?*\x00-\x1f]/.test(name) &&
    name !== "." &&
    name !== ".."
  );
}

/**
 * Checks a category folder name. Names starting with a dot are refused, so
 * hidden folders such as .trash can't be reached.
 * @param {unknown} folder
 * @returns {string} the folder name
 * @throws a 400 error if it isn't valid
 */
function requireFolderName(folder) {
  if (!isSafeName(folder) || folder.startsWith(".")) {
    throw httpError(400, "Invalid folder name");
  }
  return folder;
}

/**
 * Checks a poster's file name: a safe name ending in .jpg, .jpeg, .png or .webp.
 * @param {unknown} file
 * @returns {string} the file name
 * @throws a 400 error if it isn't valid
 */
function requirePosterFileName(file) {
  if (!isSafeName(file) || !POSTER_FILE_PATTERN.test(file)) {
    throw httpError(400, "Invalid file name");
  }
  return file;
}

/**
 * Full path of a category folder.
 * @param {unknown} folder - checked with requireFolderName
 * @returns {string}
 */
const categoryFolderPath = (folder) =>
  path.join(POSTERS_FOLDER, requireFolderName(folder));

/**
 * Full path of a poster: posters/<folder>/<file>.
 * @param {unknown} folder
 * @param {unknown} file
 * @returns {string}
 */
const posterFilePath = (folder, file) =>
  path.join(categoryFolderPath(folder), requirePosterFileName(file));

/**
 * Full path of a removed poster: posters/.trash/<folder>/<file>.
 * @param {unknown} folder - the category it was removed from
 * @param {unknown} file
 * @returns {string}
 */
const trashedPosterPath = (folder, file) =>
  path.join(
    TRASH_FOLDER,
    requireFolderName(folder),
    requirePosterFileName(file),
  );

module.exports = {
  isSafeName,
  requireFolderName,
  requirePosterFileName,
  categoryFolderPath,
  posterFilePath,
  trashedPosterPath,
};

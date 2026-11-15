// Working with files and folders on disk
const fs = require("fs/promises");
const path = require("path");
const { POSTERS_FOLDER, POSTER_FILE_PATTERN } = require("./config");

/**
 * Whether a file or folder exists.
 * @param {string} fullPath
 * @returns {Promise<boolean>}
 */
async function pathExists(fullPath) {
  try {
    await fs.access(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Moves or renames a file or folder, creating the destination's parent folder if needed.
 * @param {string} from
 * @param {string} to
 */
async function moveTo(from, to) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.rename(from, to);
}

/**
 * A short text based on the current time, used to keep file names unique.
 * @returns {string}
 */
const timestamp = () => Date.now().toString(36);

/**
 * Lists the names of the folders inside a folder.
 * @param {string} parentFolder
 * @returns {Promise<string[]>} empty if the folder doesn't exist
 */
async function listSubfolders(parentFolder) {
  try {
    const entries = await fs.readdir(parentFolder, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Lists the poster images (.jpg, .jpeg, .png, .webp) in a folder, sorted by name.
 * @param {string} folder
 * @returns {Promise<string[]>} file names; empty if the folder doesn't exist
 */
async function listImageFiles(folder) {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && POSTER_FILE_PATTERN.test(entry.name))
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

/**
 * Deletes a folder if nothing is left in it; does nothing otherwise.
 * @param {string} folder
 */
async function removeFolderIfEmpty(folder) {
  try {
    await fs.rmdir(folder);
  } catch {}
}

/**
 * Lists the images in every category folder under posters/.
 * Hidden folders such as .trash are skipped. Creates posters/ if it is missing.
 * @returns {Promise<Record<string, string[]>>} { "<folder>": ["file1.jpg", ...] }
 */
async function listPosterFilesOnDisk() {
  await fs.mkdir(POSTERS_FOLDER, { recursive: true });
  const filesByFolder = {};
  for (const folder of await listSubfolders(POSTERS_FOLDER)) {
    if (folder.startsWith(".")) continue;
    filesByFolder[folder] = await listImageFiles(path.join(POSTERS_FOLDER, folder));
  }
  return filesByFolder;
}

module.exports = {
  pathExists,
  moveTo,
  timestamp,
  listSubfolders,
  listImageFiles,
  removeFolderIfEmpty,
  listPosterFilesOnDisk,
};

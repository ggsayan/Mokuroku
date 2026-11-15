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
 * Lists the images in every category folder under posters/.
 * Hidden folders such as .trash are skipped. Creates posters/ if it is missing.
 * @returns {Promise<Record<string, string[]>>} { "<folder>": ["file1.jpg", ...] }
 */
async function listPosterFilesOnDisk() {
  await fs.mkdir(POSTERS_FOLDER, { recursive: true });
  const filesByFolder = {};
  const entries = await fs.readdir(POSTERS_FOLDER, { withFileTypes: true });
  for (const folder of entries) {
    if (!folder.isDirectory() || folder.name.startsWith(".")) continue;
    const files = await fs.readdir(path.join(POSTERS_FOLDER, folder.name), {
      withFileTypes: true,
    });
    filesByFolder[folder.name] = files
      .filter((file) => file.isFile() && POSTER_FILE_PATTERN.test(file.name))
      .map((file) => file.name)
      .sort();
  }
  return filesByFolder;
}

module.exports = { pathExists, moveTo, timestamp, listPosterFilesOnDisk };

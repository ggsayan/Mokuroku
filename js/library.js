/* The library is the app's saved state, stored in posters/library.json.
 * Each category's images live in posters/<folder>/.
 */
import { callServer, requestJson } from "./api.js";
import { DEFAULT_CATEGORY_NAMES, DEFAULT_COLUMNS } from "./config.js";
import { showToast } from "./toast.js";
import { createId } from "./utils.js";

/**
 * @typedef {object} Poster
 * @property {string} file - the image's file name inside its category's folder
 */

/**
 * @typedef {object} Category
 * @property {string} id
 * @property {string} name - shown on the tab
 * @property {string} folder - the folder under posters/ that holds its images
 * @property {number} columns - how many posters per row
 * @property {Poster[]} posters - in display order
 */

/**
 * @typedef {object} Library
 * @property {string} activeCategoryId - the tab that is open
 * @property {1 | 2} [exportScale] - the export size picked in the toolbar (1× if missing)
 * @property {Category[]} categories - in tab order
 */

/** @type {Library} set by loadLibrary() */
export let library;

/**
 * The category whose tab is open.
 * @returns {Category}
 */
export const getActiveCategory = () =>
  library.categories.find((c) => c.id === library.activeCategoryId) ||
  library.categories[0];

/**
 * The categories in the order their tabs are shown: most posters first.
 * Categories with the same number of posters keep their saved order.
 * @returns {Category[]}
 */
export const getCategoriesInTabOrder = () =>
  [...library.categories].sort((a, b) => b.posters.length - a.posters.length);

/**
 * Finds the category stored in a folder, ignoring upper/lower case.
 * @param {string} folder
 * @returns {Category | undefined}
 */
export const findCategoryByFolder = (folder) =>
  library.categories.find(
    (c) => c.folder.toLowerCase() === folder.toLowerCase(),
  );

/**
 * Makes a folder name that is valid on Windows and not used by another category.
 * @param {string} categoryName
 * @param {Category} [exceptCategory] - a category whose own folder doesn't count as taken
 *   (used when renaming it)
 * @returns {string} e.g. "Movies", or "Movies (2)" if "Movies" is taken
 */
export function makeUniqueFolderName(categoryName, exceptCategory) {
  const baseName =
    categoryName
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
      .replace(/^[. ]+|[. ]+$/g, "")
      .trim() || "Category";
  const isTaken = (folder) =>
    library.categories.some(
      (c) =>
        c !== exceptCategory && c.folder.toLowerCase() === folder.toLowerCase(),
    );
  let folder = baseName;
  for (let number = 2; isTaken(folder); number++) {
    folder = `${baseName} (${number})`;
  }
  return folder;
}

/**
 * Creates a new, empty category. It is not added to the library.
 * @param {string} name
 * @param {string} [folder] - defaults to a unique folder made from the name
 * @returns {Category}
 */
export function createCategory(name, folder = makeUniqueFolderName(name)) {
  return {
    id: createId(),
    name,
    folder,
    columns: DEFAULT_COLUMNS,
    posters: [],
  };
}

// Saves run one after another, so an older save can never overwrite a newer one
let pendingSaves = Promise.resolve();

/**
 * Writes the library to library.json on the server. Shows a message if it fails.
 * @returns {Promise<void>} resolves once this save has finished
 */
export function saveLibrary() {
  const json = JSON.stringify(library, null, 2);
  pendingSaves = pendingSaves
    .then(() => callServer("PUT", "/api/library", null, json))
    .catch((error) => {
      console.error(error);
      showToast(`Could not save library: ${error.message}`, 5000);
    });
  return pendingSaves;
}

/**
 * Loads library.json and brings it in line with what is actually in the posters folder:
 * folders and images added by hand are picked up, and deleted images are dropped.
 * @returns {Promise<void>}
 * @throws {Error} if the server can't be reached
 */
export async function loadLibrary() {
  const { library: savedLibrary, disk: filesByFolder } = await requestJson(
    "GET",
    "/api/library",
  );
  library = savedLibrary?.categories ? savedLibrary : { categories: [] };

  const isFirstRun =
    !savedLibrary?.categories && !Object.keys(filesByFolder).length;
  if (isFirstRun) {
    for (const name of DEFAULT_CATEGORY_NAMES) {
      library.categories.push(createCategory(name));
    }
  }

  // Folders created by hand become categories
  for (const folder of Object.keys(filesByFolder)) {
    if (!findCategoryByFolder(folder)) {
      library.categories.push(createCategory(folder, folder));
    }
  }

  // Images added by hand are appended; posters whose file was deleted are dropped
  for (const category of library.categories) {
    const filesOnDisk = filesByFolder[category.folder];
    if (!filesOnDisk) {
      await callServer("POST", "/api/folder", { folder: category.folder });
      continue;
    }
    const filesOnDiskSet = new Set(filesOnDisk);
    category.posters = category.posters.filter((p) =>
      filesOnDiskSet.has(p.file),
    );
    const knownFiles = new Set(category.posters.map((p) => p.file));
    for (const file of filesOnDisk) {
      if (!knownFiles.has(file)) category.posters.push({ file });
    }
  }

  if (!library.categories.length) {
    library.categories.push(createCategory("Posters"));
  }
  if (!library.categories.some((c) => c.id === library.activeCategoryId)) {
    library.activeCategoryId = library.categories[0].id;
  }
  await saveLibrary();
}

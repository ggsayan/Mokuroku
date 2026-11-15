// Switching, adding, renaming and removing categories
import { callServer, requestJson } from "./api.js";
import { elements } from "./elements.js";
import {
  createCategory,
  library,
  makeUniqueFolderName,
  saveLibrary,
} from "./library.js";
import { render, renderTabs } from "./render.js";
import { showToast } from "./toast.js";
import { plural } from "./utils.js";

/**
 * Whether another category already uses this name (ignoring upper/lower case).
 * @param {string} name
 * @param {Category} [exceptCategory] - the category being renamed, which doesn't count
 * @returns {boolean}
 */
const isNameTaken = (name, exceptCategory) =>
  library.categories.some(
    (c) => c !== exceptCategory && c.name.toLowerCase() === name.toLowerCase(),
  );

/**
 * Opens a category's tab.
 * @param {Category} category
 */
export function switchToCategory(category) {
  if (category.id === library.activeCategoryId) return;
  library.activeCategoryId = category.id;
  saveLibrary();
  render();
}

/**
 * Replaces an element in the tab bar with a name box. Enter or clicking away
 * submits; Escape, an empty name or an unchanged name cancels.
 * @param {HTMLElement} elementToReplace
 * @param {string} initialName - shown in the box to start with
 * @param {(name: string) => void} onSubmit - called with the new, trimmed name
 */
function showNameInput(elementToReplace, initialName, onSubmit) {
  const input = document.createElement("input");
  input.className = "tab-input";
  input.placeholder = "Category name";
  input.maxLength = 60;
  input.value = initialName;

  let isFinished = false;
  const finish = (shouldSubmit) => {
    if (isFinished) return;
    isFinished = true;
    const name = input.value.trim();
    if (shouldSubmit && name && name !== initialName) onSubmit(name);
    else renderTabs();
  };
  input.onkeydown = (event) => {
    if (event.key === "Enter") finish(true);
    else if (event.key === "Escape") finish(false);
  };
  input.onblur = () => finish(true);

  elementToReplace.replaceWith(input);
  input.focus();
  input.select();
}

/**
 * Replaces the "+" button with a name box for a new category.
 * @param {HTMLButtonElement} addButton
 */
export function showNewCategoryInput(addButton) {
  showNameInput(addButton, "", addCategory);
}

/**
 * Replaces a category's tab with a name box for renaming it.
 * @param {Category} category
 */
export function showRenameInput(category) {
  // Looked up by id, since the tabs may have been redrawn (e.g. by the click before a double-click)
  const tab = elements.tabs.querySelector(
    `[data-category-id="${category.id}"]`,
  );
  if (tab) showNameInput(tab, category.name, (name) => renameCategory(category, name));
}

/**
 * Renames a category, and its folder on disk to match. Refuses a name that
 * another category already uses (ignoring upper/lower case).
 * @param {Category} category
 * @param {string} newName
 */
async function renameCategory(category, newName) {
  if (isNameTaken(newName, category)) {
    showToast(`There's already a category called “${newName}”`, 4000);
    return renderTabs();
  }

  const newFolder = makeUniqueFolderName(newName, category);
  if (newFolder !== category.folder) {
    try {
      await callServer("POST", "/api/folder/rename", {
        folder: category.folder,
        to: newFolder,
      });
    } catch (error) {
      showToast(`Could not rename: ${error.message}`, 5000);
      return renderTabs();
    }
    category.folder = newFolder;
  }
  category.name = newName;
  await saveLibrary();
  render();
  showToast(`Renamed to “${newName}”`);
}

/**
 * Creates a category and its folder, then opens it. Refuses a name that is
 * already used (ignoring upper/lower case).
 * @param {string} name
 */
async function addCategory(name) {
  if (isNameTaken(name)) {
    showToast(`There's already a category called “${name}”`, 4000);
    return renderTabs();
  }

  const category = createCategory(name);
  try {
    await callServer("POST", "/api/folder", { folder: category.folder });
  } catch (error) {
    showToast(`Could not add category: ${error.message}`, 5000);
    return renderTabs();
  }
  library.categories.push(category);
  library.activeCategoryId = category.id;
  await saveLibrary();
  render();
  showToast(`Added “${name}”`);
}

/**
 * Removes a category, asking first if it has posters. The server moves its folder
 * to posters/.trash/.categories/, and an Undo button is shown.
 * The last remaining category can't be removed.
 * @param {Category} category
 */
export async function removeCategory(category) {
  if (library.categories.length < 2) {
    return showToast("Can't remove the only category", 4000);
  }
  const posterCount = category.posters.length;
  const confirmed =
    posterCount === 0 ||
    confirm(
      `Remove “${category.name}” and its ${plural(posterCount, "poster")}?\n\n` +
        "The folder is moved to posters/.trash, and you can undo right after.",
    );
  if (!confirmed) return;

  let trashedFolderName;
  try {
    ({ trashed: trashedFolderName } = await requestJson(
      "DELETE",
      "/api/folder",
      { folder: category.folder },
    ));
  } catch (error) {
    return showToast(`Could not remove category: ${error.message}`, 5000);
  }

  const position = library.categories.indexOf(category);
  library.categories.splice(position, 1);
  if (library.activeCategoryId === category.id) {
    const neighbour =
      library.categories[Math.min(position, library.categories.length - 1)];
    library.activeCategoryId = neighbour.id;
  }
  await saveLibrary();
  render();
  showToast(`Removed “${category.name}”`, 8000, {
    label: "Undo",
    onClick: () => restoreCategory(category, position, trashedFolderName),
  });
}

/**
 * Undoes removeCategory: moves the folder back out of the trash and puts the
 * category back where its tab was.
 * @param {Category} category - the removed category
 * @param {number} position - where its tab was
 * @param {string | null} trashedFolderName - the name the server gave it in the trash,
 *   or null if its folder was already missing
 */
async function restoreCategory(category, position, trashedFolderName) {
  try {
    if (trashedFolderName) {
      await callServer("POST", "/api/folder/restore", {
        trashed: trashedFolderName,
        folder: category.folder,
      });
    } else {
      await callServer("POST", "/api/folder", { folder: category.folder });
    }
  } catch (error) {
    return showToast(
      `Could not restore “${category.name}”: ${error.message}`,
      5000,
    );
  }
  library.categories.splice(position, 0, category);
  library.activeCategoryId = category.id;
  await saveLibrary();
  render();
  showToast(`Restored “${category.name}”`);
}

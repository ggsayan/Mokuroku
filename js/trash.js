// The Trash panel: shows removed posters and categories, and restores or deletes them for good
import { callServer, requestJson } from "./api.js";
import { elements } from "./elements.js";
import {
  findCategoryByFolder,
  getActiveCategory,
  library,
  loadLibrary,
  makeUniqueFolderName,
  saveLibrary,
} from "./library.js";
import { render } from "./render.js";
import { showToast } from "./toast.js";
import { plural } from "./utils.js";

/**
 * @typedef {object} TrashedPoster
 * @property {string} folder - the category folder it was removed from
 * @property {string} file
 */

/**
 * @typedef {object} TrashedCategory
 * @property {string} trashed - its folder's name in the trash
 * @property {string} folder - its folder's name before it was removed
 * @property {number | null} removedAt - when it was removed, in milliseconds
 * @property {string[]} files - its poster images
 */

/**
 * Builds the address of an image in the trash.
 * @param {...string} parts - folders and file name inside posters/.trash/
 * @returns {string}
 */
const trashImageUrl = (...parts) =>
  "/posters/.trash/" + parts.map(encodeURIComponent).join("/");

/**
 * Creates an element with a class and optional text.
 * @param {string} tag
 * @param {string} className
 * @param {string} [text]
 * @returns {HTMLElement}
 */
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * Creates a small button for an item in the trash.
 * @param {string} label
 * @param {() => void} onClick
 * @param {string} [extraClass] - e.g. "danger"
 * @param {string} [title] - tooltip
 * @returns {HTMLButtonElement}
 */
function createButton(label, onClick, extraClass = "", title = "") {
  const button = createElement("button", `btn small ${extraClass}`, label);
  button.title = title;
  button.onclick = onClick;
  return button;
}

/**
 * The category a trashed poster goes back into: the one stored in the folder it
 * came from, or the open category if that one no longer exists.
 * @param {TrashedPoster} item
 * @returns {Category}
 */
const restoreTargetFor = (item) =>
  findCategoryByFolder(item.folder) ?? getActiveCategory();

/** Opens the Trash panel and loads what is in the trash. */
async function openTrash() {
  elements.trashDialog.hidden = false;
  elements.trashContent.replaceChildren(createElement("p", "trash-message", "Loading…"));
  await refreshTrash();
}

/** Closes the Trash panel. */
function closeTrash() {
  elements.trashDialog.hidden = true;
}

/** Reloads the trash from the server and redraws the panel. */
async function refreshTrash() {
  let trash;
  try {
    trash = await requestJson("GET", "/api/trash");
  } catch (error) {
    elements.trashContent.replaceChildren(
      createElement("p", "trash-message", `Could not load the trash: ${error.message}`),
    );
    return;
  }

  const isEmpty = !trash.posters.length && !trash.categories.length;
  if (isEmpty) {
    elements.trashContent.replaceChildren(
      createElement("p", "trash-message", "The trash is empty."),
    );
    return;
  }
  elements.trashContent.replaceChildren(
    ...renderTrashedCategories(trash.categories),
    ...renderTrashedPosters(trash.posters),
  );
}

/**
 * Draws the "Removed categories" section: one row per category.
 * @param {TrashedCategory[]} categories
 * @returns {HTMLElement[]} nothing if there are none
 */
function renderTrashedCategories(categories) {
  if (!categories.length) return [];
  const rows = categories.map((item) => {
    const row = createElement("div", "trash-category");

    const preview = createElement("div", "trash-category-preview");
    if (item.files.length) {
      const image = document.createElement("img");
      image.src = trashImageUrl(".categories", item.trashed, item.files[0]);
      image.alt = "";
      image.loading = "lazy";
      preview.append(image);
    }

    const details = createElement("div", "trash-category-details");
    const removedOn = item.removedAt
      ? ` · removed ${new Date(item.removedAt).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}`
      : "";
    details.append(
      createElement("strong", "", item.folder),
      createElement("span", "trash-meta", plural(item.files.length, "poster") + removedOn),
    );

    const actions = createElement("div", "trash-actions");
    actions.append(
      createButton("Restore", () => restoreTrashedCategory(item)),
      createButton("Delete forever", () => deleteTrashedCategory(item), "danger"),
    );

    row.append(preview, details, actions);
    return row;
  });
  return [createElement("h3", "trash-heading", "Removed categories"), ...rows];
}

/**
 * Draws the removed posters, in one group per folder they came from.
 * @param {TrashedPoster[]} posters
 * @returns {HTMLElement[]} nothing if there are none
 */
function renderTrashedPosters(posters) {
  if (!posters.length) return [];
  const postersByFolder = new Map();
  for (const item of posters) {
    if (!postersByFolder.has(item.folder)) postersByFolder.set(item.folder, []);
    postersByFolder.get(item.folder).push(item);
  }
  const sections = [createElement("h3", "trash-heading", "Removed posters")];

  for (const [folder, items] of postersByFolder) {
    const target = restoreTargetFor(items[0]);
    sections.push(
      createElement(
        "p",
        "trash-meta",
        `From “${folder}” · restores to “${target.name}”`,
      ),
    );
    const grid = createElement("div", "trash-grid");
    for (const item of items) {
      const card = createElement("figure", "trash-poster");
      const image = document.createElement("img");
      image.src = trashImageUrl(item.folder, item.file);
      image.alt = "";
      image.loading = "lazy";
      const actions = createElement("div", "trash-actions");
      actions.append(
        createButton("Restore", () => restoreTrashedPoster(item)),
        createButton("Delete", () => deleteTrashedPoster(item), "danger", "Delete forever"),
      );
      card.append(image, actions);
      grid.append(card);
    }
    sections.push(grid);
  }
  return sections;
}

/**
 * Moves a removed poster back to the end of its category.
 * @param {TrashedPoster} item
 */
async function restoreTrashedPoster(item) {
  const target = restoreTargetFor(item);
  try {
    await callServer("POST", "/api/poster/restore", {
      folder: item.folder,
      file: item.file,
      to: target.folder,
    });
  } catch (error) {
    return showToast(`Could not restore the poster: ${error.message}`, 5000);
  }
  if (!target.posters.some((p) => p.file === item.file)) {
    target.posters.push({ file: item.file });
  }
  await saveLibrary();
  render();
  await refreshTrash();
  showToast(`Restored to “${target.name}”`);
}

/**
 * Brings back a removed category with its posters, and opens it. It is named after
 * its folder; if that name is now taken, " (2)" etc. is added.
 * @param {TrashedCategory} item
 */
async function restoreTrashedCategory(item) {
  const folder = makeUniqueFolderName(item.folder);
  try {
    await callServer("POST", "/api/folder/restore", {
      trashed: item.trashed,
      folder,
    });
  } catch (error) {
    return showToast(`Could not restore “${item.folder}”: ${error.message}`, 5000);
  }

  // Reloading picks up the restored folder as a category, with all its posters
  await saveLibrary();
  await loadLibrary();
  const restored = findCategoryByFolder(folder);
  if (restored) library.activeCategoryId = restored.id;
  await saveLibrary();
  render();
  await refreshTrash();
  showToast(`Restored “${folder}”`);
}

/**
 * Deletes a removed poster for good.
 * @param {TrashedPoster} item
 */
async function deleteTrashedPoster(item) {
  try {
    await callServer("DELETE", "/api/trash/poster", {
      folder: item.folder,
      file: item.file,
    });
  } catch (error) {
    return showToast(`Could not delete the poster: ${error.message}`, 5000);
  }
  await refreshTrash();
}

/**
 * Deletes a removed category and its posters for good, after asking.
 * @param {TrashedCategory} item
 */
async function deleteTrashedCategory(item) {
  const confirmed = confirm(
    `Delete “${item.folder}” and its ${plural(item.files.length, "poster")} for good?\n\n` +
      "This can't be undone.",
  );
  if (!confirmed) return;
  try {
    await callServer("DELETE", "/api/trash/category", { trashed: item.trashed });
  } catch (error) {
    return showToast(`Could not delete “${item.folder}”: ${error.message}`, 5000);
  }
  await refreshTrash();
}

/** Connects the Trash button and the panel's controls: ×, Escape and clicking the backdrop close it. */
export function setUpTrash() {
  elements.trashButton.onclick = openTrash;
  elements.trashCloseButton.onclick = closeTrash;
  elements.trashDialog.onclick = (event) => {
    if (event.target === elements.trashDialog) closeTrash();
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.trashDialog.hidden) closeTrash();
  });
}

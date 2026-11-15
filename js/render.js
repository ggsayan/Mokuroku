// Draws the category tabs and the poster grid from the library
import { posterImageUrl } from "./api.js";
import {
  showNewCategoryInput,
  showRenameInput,
  switchToCategory,
} from "./categories.js";
import { LOW_RESOLUTION_WIDTH } from "./config.js";
import { showCategoryMenu, showPosterMenu } from "./contextMenu.js";
import { elements } from "./elements.js";
import { getActiveCategory, getCategoriesInTabOrder } from "./library.js";
import { makeTabDropTarget } from "./posterDrag.js";
import { removePoster } from "./posters.js";
import { openViewer } from "./viewer.js";

/** Redraws the whole page (tabs and grid) from the library. */
export function render() {
  renderTabs();
  renderGrid();
}

/** Redraws the category tabs, most posters first, followed by the "+" button. */
export function renderTabs() {
  const activeCategory = getActiveCategory();
  elements.tabs.replaceChildren(
    ...getCategoriesInTabOrder().map((category) =>
      createTab(category, category === activeCategory),
    ),
    createAddCategoryButton(),
  );
}

/**
 * Creates one category tab with its poster count. Clicking opens it, double-clicking
 * renames it, and right-clicking shows its menu. Other categories' tabs accept
 * dragged posters.
 * @param {Category} category
 * @param {boolean} isActive - whether this is the open tab
 * @returns {HTMLButtonElement}
 */
function createTab(category, isActive) {
  const tab = document.createElement("button");
  tab.className = "tab" + (isActive ? " active" : "");
  tab.textContent = category.name;
  tab.dataset.categoryId = category.id;

  const posterCount = document.createElement("span");
  posterCount.className = "count";
  posterCount.textContent = category.posters.length;
  tab.append(posterCount);

  tab.onclick = () => switchToCategory(category);
  tab.ondblclick = () => showRenameInput(category);
  tab.oncontextmenu = (event) => {
    event.preventDefault();
    showCategoryMenu(event.clientX, event.clientY, category);
  };
  if (!isActive) makeTabDropTarget(tab, category);
  return tab;
}

/**
 * Creates the "+" button that starts adding a category.
 * @returns {HTMLButtonElement}
 */
function createAddCategoryButton() {
  const button = document.createElement("button");
  button.className = "tab add-tab";
  button.title = "Add category";
  button.textContent = "+";
  button.onclick = () => showNewCategoryInput(button);
  return button;
}

/** Redraws the poster grid for the open category. */
function renderGrid() {
  const category = getActiveCategory();
  showColumnCount(category.columns);
  elements.emptyMessage.hidden = category.posters.length > 0;
  elements.grid.replaceChildren(
    ...category.posters.map((poster) => createPosterCard(category, poster)),
  );
}

/**
 * Sets the grid's number of columns and updates the slider to match.
 * @param {number} columns
 */
export function showColumnCount(columns) {
  elements.columnsSlider.value = columns;
  elements.columnsValue.textContent = columns;
  elements.grid.style.setProperty("--cols", columns);
}

/**
 * Creates one poster in the grid. Clicking opens the popup, right-clicking shows
 * its menu, and the × button removes it. Once its image has loaded, a "Low res"
 * badge is added if it is narrower than LOW_RESOLUTION_WIDTH.
 * @param {Category} category - the category the poster belongs to
 * @param {Poster} poster
 * @returns {HTMLElement}
 */
function createPosterCard(category, poster) {
  const card = document.createElement("figure");
  card.className = "poster";
  card.dataset.file = poster.file;

  const frame = document.createElement("div");
  frame.className = "frame";
  frame.draggable = true;

  const image = document.createElement("img");
  image.src = posterImageUrl(category, poster);
  image.alt = "";
  image.loading = "lazy";
  image.draggable = false;
  image.onload = () => {
    if (image.naturalWidth < LOW_RESOLUTION_WIDTH)
      frame.append(createLowResBadge(image));
  };

  const removeButton = document.createElement("button");
  removeButton.className = "remove";
  removeButton.title = "Remove poster";
  removeButton.textContent = "×";
  removeButton.onclick = (event) => {
    event.stopPropagation();
    removePoster(poster.file);
  };

  // The position is looked up on click, since dragging can change the order
  frame.onclick = () =>
    openViewer(category.posters.findIndex((p) => p.file === poster.file));
  frame.oncontextmenu = (event) => {
    event.preventDefault();
    showPosterMenu(event.clientX, event.clientY, poster.file);
  };

  frame.append(image, removeButton);
  card.append(frame);
  return card;
}

/**
 * Creates the "Low res" badge for a poster whose image is small.
 * @param {HTMLImageElement} image - the loaded poster image
 * @returns {HTMLElement}
 */
function createLowResBadge(image) {
  const badge = document.createElement("span");
  badge.className = "low-res-badge";
  badge.textContent = "Low res";
  badge.title = `Low resolution: ${image.naturalWidth} × ${image.naturalHeight} px`;
  return badge;
}

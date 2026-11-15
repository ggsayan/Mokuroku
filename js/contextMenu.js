// The right-click menus for posters and category tabs
import { removeCategory, showRenameInput } from "./categories.js";
import { elements } from "./elements.js";
import { getActiveCategory, getCategoriesInTabOrder } from "./library.js";
import { movePoster, removePoster } from "./posters.js";

/**
 * Shows a poster's right-click menu: move it to another category, or remove it.
 * @param {number} x - where to show the menu, in window pixels
 * @param {number} y
 * @param {string} file - the poster's file name
 */
export function showPosterMenu(x, y, file) {
  const heading = document.createElement("div");
  heading.className = "menu-heading";
  heading.textContent = "Move poster to";

  const otherCategories = getCategoriesInTabOrder().filter(
    (c) => c !== getActiveCategory(),
  );
  showMenu(x, y, [
    heading,
    ...otherCategories.map((category) =>
      createMenuItem(category.name, () => movePoster(file, category)),
    ),
    document.createElement("hr"),
    createMenuItem("Remove poster", () => removePoster(file), "danger"),
  ]);
}

/**
 * Shows a category tab's right-click menu: rename or remove the category.
 * @param {number} x - where to show the menu, in window pixels
 * @param {number} y
 * @param {Category} category
 */
export function showCategoryMenu(x, y, category) {
  showMenu(x, y, [
    createMenuItem("Rename", () => showRenameInput(category)),
    createMenuItem(
      `Remove “${category.name}”`,
      () => removeCategory(category),
      "danger",
    ),
  ]);
}

/**
 * Creates a menu entry that closes the menu and then runs its action.
 * @param {string} label
 * @param {() => void} onClick
 * @param {string} [extraClass] - e.g. "danger" for red text
 * @returns {HTMLButtonElement}
 */
function createMenuItem(label, onClick, extraClass = "") {
  const button = document.createElement("button");
  button.className = `menu-item ${extraClass}`;
  button.textContent = label;
  button.onclick = () => {
    closeMenu();
    onClick();
  };
  return button;
}

/**
 * Fills the menu with items and shows it at a point, kept inside the window.
 * @param {number} x
 * @param {number} y
 * @param {HTMLElement[]} items
 */
function showMenu(x, y, items) {
  const menu = elements.contextMenu;
  menu.replaceChildren(...items);
  menu.hidden = false;

  const size = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, innerWidth - size.width - 8) + "px";
  menu.style.top = Math.min(y, innerHeight - size.height - 8) + "px";
}

/** Hides the menu. */
function closeMenu() {
  elements.contextMenu.hidden = true;
}

/** Makes the menu close on a click elsewhere, Escape, scrolling, or leaving the window. */
export function setUpContextMenu() {
  document.addEventListener("pointerdown", (event) => {
    if (!elements.contextMenu.contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
  addEventListener("blur", closeMenu);
  addEventListener("scroll", closeMenu, true);
}

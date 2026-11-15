// Dragging posters within the grid to reorder them, or onto a tab to move them
import { elements } from "./elements.js";
import { getActiveCategory, saveLibrary } from "./library.js";
import { movePoster } from "./posters.js";

let draggedPosterElement = null;
let categoryDroppedOn = null; // set when the poster is dropped on a tab

/**
 * Whether a poster from the grid is being dragged right now.
 * @returns {boolean}
 */
export const isDraggingPoster = () => draggedPosterElement !== null;

/**
 * Lets a dragged poster be dropped on a tab. The move itself happens in
 * handleDragEnd, once the drag is over.
 * @param {HTMLElement} tab
 * @param {Category} category - the tab's category
 */
export function makeTabDropTarget(tab, category) {
  tab.ondragover = (event) => {
    if (!isDraggingPoster()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    tab.classList.add("drop-target");
  };
  tab.ondragleave = () => tab.classList.remove("drop-target");
  tab.ondrop = (event) => {
    tab.classList.remove("drop-target");
    if (!isDraggingPoster()) return;
    event.preventDefault();
    categoryDroppedOn = category;
  };
}

/**
 * Remembers which poster started being dragged and dims it.
 * @param {DragEvent} event
 */
function handleDragStart(event) {
  draggedPosterElement = event.target.closest(".poster");
  if (!draggedPosterElement) return;
  draggedPosterElement.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedPosterElement.dataset.file); // Firefox won't start a drag without data
}

/**
 * Moves the dragged poster before or after the poster under the pointer,
 * depending on which half of it the pointer is over.
 * @param {DragEvent} event
 */
function handleDragOver(event) {
  if (!draggedPosterElement) return;
  event.preventDefault();
  const cardUnderPointer = event.target.closest(".poster");
  if (!cardUnderPointer || cardUnderPointer === draggedPosterElement) return;
  const box = cardUnderPointer.getBoundingClientRect();
  const isRightHalf = event.clientX > box.left + box.width / 2;
  if (isRightHalf) cardUnderPointer.after(draggedPosterElement);
  else cardUnderPointer.before(draggedPosterElement);
}

/**
 * Finishes a drag: moves the poster if it was dropped on a tab,
 * otherwise saves the new order shown in the grid.
 */
function handleDragEnd() {
  if (!draggedPosterElement) return;
  draggedPosterElement.classList.remove("dragging");
  const file = draggedPosterElement.dataset.file;
  draggedPosterElement = null;

  if (categoryDroppedOn) {
    const targetCategory = categoryDroppedOn;
    categoryDroppedOn = null;
    return movePoster(file, targetCategory);
  }

  const category = getActiveCategory();
  const posterByFile = new Map(category.posters.map((p) => [p.file, p]));
  category.posters = [...elements.grid.children]
    .map((card) => posterByFile.get(card.dataset.file))
    .filter(Boolean);
  saveLibrary();
}

/** Connects the drag events of the poster grid. */
export function setUpPosterDragging() {
  elements.grid.addEventListener("dragstart", handleDragStart);
  elements.grid.addEventListener("dragover", handleDragOver);
  elements.grid.addEventListener("dragend", handleDragEnd);
  elements.grid.addEventListener("drop", (event) => {
    if (isDraggingPoster()) event.preventDefault();
  });
}

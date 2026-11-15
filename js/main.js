/* Mokuroku Poster Shelf — entry point, loaded by index.html.
 * Sets up each part of the page, then loads the library from the server and draws it.
 */
import { setUpContextMenu } from "./contextMenu.js";
import { elements } from "./elements.js";
import { setUpImageImport } from "./imageImport.js";
import { getActiveCategory, library, loadLibrary, saveLibrary } from "./library.js";
import { setUpPngExport } from "./pngExport.js";
import { setUpPosterDragging } from "./posterDrag.js";
import { render, showColumnCount } from "./render.js";
import { setUpViewer } from "./viewer.js";

/**
 * Connects the Columns slider. The grid updates while dragging;
 * the library is saved when the slider is let go.
 */
function setUpColumnsSlider() {
  elements.columnsSlider.oninput = () => {
    const category = getActiveCategory();
    category.columns = Number(elements.columnsSlider.value);
    showColumnCount(category.columns);
  };
  elements.columnsSlider.onchange = () => saveLibrary();
}

setUpImageImport();
setUpColumnsSlider();
setUpPngExport();
setUpViewer();
setUpContextMenu();
setUpPosterDragging();

try {
  await loadLibrary();
  elements.exportScaleSelect.value = library.exportScale === 2 ? "2" : "1";
  render();
} catch (error) {
  console.error(error);
  elements.serverNotice.hidden = false;
}

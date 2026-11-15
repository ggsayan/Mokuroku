// Saving categories as PNG images into the exports/ folder
import { callServer, posterImageUrl } from "./api.js";
import {
  CANVAS_MAX_AREA,
  CANVAS_MAX_SIDE,
  EXPORT_COLORS,
  EXPORT_FONT,
  EXPORT_LAYOUT,
} from "./config.js";
import { elements } from "./elements.js";
import { getActiveCategory, library } from "./library.js";
import { showToast } from "./toast.js";
import { plural, toSafeFileName } from "./utils.js";

/**
 * Draws an image so it fills the box completely, cropping whatever overflows
 * (like CSS object-fit: cover).
 * @param {CanvasRenderingContext2D} context
 * @param {ImageBitmap} image
 * @param {number} x - the box's position and size on the canvas
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
function drawImageCover(context, image, x, y, width, height) {
  const zoom = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / zoom;
  const sourceHeight = height / zoom;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

/**
 * Draws a category as one image: its name, the number of titles, and its posters
 * in a grid with the category's column count. Posters that can't be loaded are skipped.
 * The image is drawn smaller if it would be larger than the browser can draw.
 * @param {Category} category
 * @returns {Promise<{ pngBlob: Blob, scale: number }>} the PNG and the scale used
 *   (1 unless it had to be drawn smaller)
 */
async function renderCategoryPng(category) {
  const { posters } = category;
  const {
    posterWidth,
    posterHeight,
    gap,
    padding,
    headerHeight,
    cornerRadius,
  } = EXPORT_LAYOUT;

  const columns = Math.min(category.columns, posters.length);
  const rows = Math.ceil(posters.length / columns);
  const width = padding * 2 + columns * posterWidth + (columns - 1) * gap;
  const height =
    padding * 2 + headerHeight + rows * posterHeight + (rows - 1) * gap;
  const scale = Math.min(
    1,
    CANVAS_MAX_SIDE / width,
    CANVAS_MAX_SIDE / height,
    Math.sqrt(CANVAS_MAX_AREA / (width * height)),
  );

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(width * scale);
  canvas.height = Math.floor(height * scale);
  const context = canvas.getContext("2d");
  context.scale(scale, scale); // everything below is drawn in full-size units
  context.imageSmoothingQuality = "high";

  context.fillStyle = EXPORT_COLORS.background;
  context.fillRect(0, 0, width, height);

  context.textBaseline = "top";
  context.fillStyle = EXPORT_COLORS.title;
  context.font = `700 44px ${EXPORT_FONT}`;
  context.fillText(category.name, padding, padding);
  context.fillStyle = EXPORT_COLORS.subtitle;
  context.font = `400 22px ${EXPORT_FONT}`;
  context.fillText(plural(posters.length, "title"), padding, padding + 58);

  for (const [index, poster] of posters.entries()) {
    const x = padding + (index % columns) * (posterWidth + gap);
    const y =
      padding +
      headerHeight +
      Math.floor(index / columns) * (posterHeight + gap);

    let bitmap;
    try {
      const response = await fetch(posterImageUrl(category, poster));
      if (!response.ok) continue;
      bitmap = await createImageBitmap(await response.blob());
    } catch {
      continue;
    }

    context.save();
    context.beginPath();
    context.roundRect(x, y, posterWidth, posterHeight, cornerRadius);
    context.clip();
    drawImageCover(context, bitmap, x, y, posterWidth, posterHeight);
    context.restore();
    bitmap.close();
  }

  const pngBlob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!pngBlob) throw new Error("the image is too large for the browser");
  return { pngBlob, scale };
}

/**
 * Renders a category and saves it into exports/, named after the category.
 * @param {Category} category
 * @returns {Promise<string>} the file name, with a note if it had to be saved smaller
 */
async function saveCategoryPng(category) {
  const { pngBlob, scale } = await renderCategoryPng(category);
  const file = `${toSafeFileName(category.name)}.png`;
  await callServer("PUT", "/api/export", { file }, pngBlob);

  return scale < 1
    ? `${file} (too large, saved at ${Math.round(scale * 100)}% size)`
    : file;
}

/** "Save PNG": exports the open category. */
async function exportActiveCategory() {
  const category = getActiveCategory();
  if (!category.posters.length) {
    return showToast("Nothing to export in this category");
  }
  showToast(`Rendering ${plural(category.posters.length, "poster")}…`, 60000);
  try {
    const savedFile = await saveCategoryPng(category);
    showToast(`Saved to exports/${savedFile}`, 5000);
  } catch (error) {
    showToast(`Export failed: ${error.message}`, 5000);
  }
}

/** "Save all": exports every category that has posters, one PNG each. */
async function exportAllCategories() {
  const categories = library.categories.filter((c) => c.posters.length);
  if (!categories.length) return showToast("Nothing to export");

  const savedFiles = [];
  const failedNames = [];
  for (const [index, category] of categories.entries()) {
    showToast(
      `Rendering ${category.name} (${index + 1}/${categories.length})…`,
      60000,
    );
    try {
      savedFiles.push(await saveCategoryPng(category));
    } catch (error) {
      console.error(error);
      failedNames.push(category.name);
    }
  }

  const failedNote = failedNames.length
    ? ` · failed: ${failedNames.join(", ")}`
    : "";
  showToast(
    `Saved ${plural(savedFiles.length, "PNG")} to exports/${failedNote}`,
    5000,
  );
}

/** Connects the two save buttons in the toolbar. */
export function setUpPngExport() {
  elements.exportButton.onclick = exportActiveCategory;
  elements.exportAllButton.onclick = exportAllCategories;
}

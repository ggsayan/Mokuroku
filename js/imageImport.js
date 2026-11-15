// Getting new images in: the file picker, dropped files, images dragged from websites, and pasting.
// Dropping onto a poster, or pasting/dropping while the popup is open, replaces that poster's image.
import { callServer } from "./api.js";
import { elements } from "./elements.js";
import { getDroppedImageAddresses } from "./imageUrls.js";
import { isDraggingPoster } from "./posterDrag.js";
import { addPosters, replacePosterImage } from "./posters.js";
import { showToast } from "./toast.js";
import { getShownPosterFile } from "./viewer.js";

let externalDragDepth = 0; // dragenter/dragleave also fire for child elements
let replaceTargetCard = null; // the poster highlighted as "Replace" during a drag

/**
 * Whether a drag comes from outside the page (files, or an image from a website)
 * rather than a poster being reordered.
 * @param {DragEvent} event
 * @returns {boolean}
 */
const isExternalDrag = (event) =>
  !isDraggingPoster() &&
  [...event.dataTransfer.types].some((type) =>
    ["Files", "text/uri-list", "text/html"].includes(type),
  );

/**
 * Highlights the poster a drop would replace, removing the highlight from the previous one.
 * @param {HTMLElement | null} card - null to remove the highlight
 */
function setReplaceTarget(card) {
  if (card === replaceTargetCard) return;
  replaceTargetCard?.classList.remove("replace-target");
  replaceTargetCard = card;
  card?.classList.add("replace-target");
}

/**
 * Downloads an image. Other websites block the browser from downloading their
 * images, so web addresses are fetched by the server instead.
 * @param {string} url - a web address, or a data:/blob: address
 * @returns {Promise<Blob>}
 */
async function downloadImage(url) {
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return (await fetch(url)).blob();
  }
  return (await callServer("POST", "/api/fetch", { url })).blob();
}

/**
 * Downloads the first of the addresses that works.
 * @param {string[]} addresses - best quality first
 * @returns {Promise<Blob>}
 * @throws the last download's error if none of them work
 */
async function downloadFirstWorking(addresses) {
  let lastError;
  for (const address of addresses) {
    try {
      return await downloadImage(address);
    } catch (error) {
      console.warn(`Couldn't download ${address}:`, error.message);
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * The images in a drop: image files, or else the addresses of an image dragged
 * from a website (best quality first).
 * @param {DataTransfer} dataTransfer
 * @returns {{ imageFiles: File[], addresses: string[] }} both empty if nothing usable was dropped
 */
function readDrop(dataTransfer) {
  const imageFiles = [...dataTransfer.files].filter((file) =>
    file.type.startsWith("image/"),
  );
  const addresses = imageFiles.length
    ? []
    : getDroppedImageAddresses(dataTransfer);
  return { imageFiles, addresses };
}

/**
 * Adds everything in a drop as new posters.
 * @param {{ imageFiles: File[], addresses: string[] }} drop
 */
async function addFromDrop({ imageFiles, addresses }) {
  if (imageFiles.length) return addPosters(imageFiles);
  showToast("Downloading image…", 20000);
  try {
    await addPosters([await downloadFirstWorking(addresses)]);
  } catch (error) {
    console.error(error);
    showToast(`Couldn't add that image: ${error.message}`, 6000);
  }
}

/**
 * Replaces a poster's image with the first image in a drop.
 * @param {string} file - the poster's file name
 * @param {{ imageFiles: File[], addresses: string[] }} drop
 */
async function replaceFromDrop(file, { imageFiles, addresses }) {
  if (imageFiles.length) return replacePosterImage(file, imageFiles[0]);
  showToast("Downloading image…", 20000);
  try {
    await replacePosterImage(file, await downloadFirstWorking(addresses));
  } catch (error) {
    console.error(error);
    showToast(`Couldn't use that image: ${error.message}`, 6000);
  }
}

/**
 * Lets you pick an image file, then replaces a poster's image with it.
 * @param {string} file - the poster's file name
 */
export function chooseReplacementImage(file) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";
  picker.onchange = () => {
    if (picker.files[0]) replacePosterImage(file, picker.files[0]);
  };
  picker.click();
}

/**
 * Highlights the page when something is dragged in from outside.
 * @param {DragEvent} event
 */
function handleDragEnter(event) {
  if (!isExternalDrag(event)) return;
  externalDragDepth++;
  elements.stage.classList.add("drop");
}

/** Removes the highlights once the drag has left the page completely. */
function handleDragLeave() {
  externalDragDepth--;
  if (externalDragDepth <= 0) {
    externalDragDepth = 0;
    elements.stage.classList.remove("drop");
    setReplaceTarget(null);
  }
}

/**
 * Allows dropping, and highlights the poster under the pointer as the one to replace.
 * @param {DragEvent} event
 */
function handleDragOver(event) {
  if (!isExternalDrag(event)) return;
  event.preventDefault();
  setReplaceTarget(event.target.closest(".poster"));
}

/**
 * Handles a drop on the page: onto a poster it replaces that poster's image,
 * anywhere else it adds new posters.
 * @param {DragEvent} event
 */
function handleDrop(event) {
  if (isDraggingPoster()) return;
  event.preventDefault();
  const card = event.target.closest(".poster");
  externalDragDepth = 0;
  elements.stage.classList.remove("drop");
  setReplaceTarget(null);

  const drop = readDrop(event.dataTransfer);
  if (!drop.imageFiles.length && !drop.addresses.length) {
    if (event.dataTransfer.files.length) showToast("No images found");
    return;
  }
  if (card) replaceFromDrop(card.dataset.file, drop);
  else addFromDrop(drop);
}

/**
 * Handles a drop on the popup: replaces the image of the poster it shows.
 * @param {DragEvent} event
 */
function handleViewerDrop(event) {
  const file = getShownPosterFile();
  if (!file || !isExternalDrag(event)) return;
  event.preventDefault();
  const drop = readDrop(event.dataTransfer);
  if (drop.imageFiles.length || drop.addresses.length)
    replaceFromDrop(file, drop);
  else showToast("No images found");
}

/**
 * Adds images pasted with Ctrl+V, or replaces the popup's poster if it is open.
 * @param {ClipboardEvent} event
 */
function handlePaste(event) {
  const imageFiles = [...event.clipboardData.items]
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile());
  if (!imageFiles.length) return;
  event.preventDefault();

  const shownFile = getShownPosterFile();
  if (shownFile) replacePosterImage(shownFile, imageFiles[0]);
  else addPosters(imageFiles);
}

/**
 * Connects every way of adding or replacing images: the "Add posters" picker,
 * dropping on the page or the popup, and pasting.
 */
export function setUpImageImport() {
  elements.fileInput.onchange = () => {
    addPosters([...elements.fileInput.files]);
    elements.fileInput.value = ""; // so picking the same file again still triggers a change
  };

  elements.stage.addEventListener("dragenter", handleDragEnter);
  elements.stage.addEventListener("dragleave", handleDragLeave);
  elements.stage.addEventListener("dragover", handleDragOver);
  elements.stage.addEventListener("drop", handleDrop);

  elements.viewer.addEventListener("dragover", (event) => {
    if (getShownPosterFile() && isExternalDrag(event)) event.preventDefault();
  });
  elements.viewer.addEventListener("drop", handleViewerDrop);

  document.addEventListener("paste", handlePaste);
}

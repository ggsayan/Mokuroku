// Getting new images in: the file picker, dropped files, images dragged from websites, and pasting
import { callServer } from "./api.js";
import { elements } from "./elements.js";
import { getDroppedImageAddresses } from "./imageUrls.js";
import { isDraggingPoster } from "./posterDrag.js";
import { addPosters } from "./posters.js";
import { showToast } from "./toast.js";

let externalDragDepth = 0; // dragenter/dragleave also fire for child elements

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
 * Downloads the first of the addresses that works and adds it as a poster,
 * showing progress and errors.
 * @param {string[]} addresses - best quality first
 */
async function addPosterFromAddresses(addresses) {
  showToast("Downloading image…", 20000);
  let lastError;
  for (const address of addresses) {
    let image;
    try {
      image = await downloadImage(address);
    } catch (error) {
      console.warn(`Couldn't download ${address}:`, error.message);
      lastError = error;
      continue;
    }
    return addPosters([image]);
  }
  showToast(`Couldn't add that image: ${lastError.message}`, 6000);
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

/** Removes the highlight once the drag has left the page completely. */
function handleDragLeave() {
  externalDragDepth--;
  if (externalDragDepth <= 0) {
    externalDragDepth = 0;
    elements.stage.classList.remove("drop");
  }
}

/**
 * Adds dropped image files, or the image dragged from another website.
 * @param {DragEvent} event
 */
function handleDrop(event) {
  if (isDraggingPoster()) return;
  event.preventDefault();
  externalDragDepth = 0;
  elements.stage.classList.remove("drop");

  const imageFiles = [...event.dataTransfer.files].filter((file) =>
    file.type.startsWith("image/"),
  );
  if (imageFiles.length) return addPosters(imageFiles);

  const addresses = getDroppedImageAddresses(event.dataTransfer);
  if (addresses.length) addPosterFromAddresses(addresses);
  else if (event.dataTransfer.files.length) showToast("No images found");
}

/**
 * Adds images pasted with Ctrl+V.
 * @param {ClipboardEvent} event
 */
function handlePaste(event) {
  const imageFiles = [...event.clipboardData.items]
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile());
  if (imageFiles.length) {
    event.preventDefault();
    addPosters(imageFiles);
  }
}

/** Connects every way of adding images: the "Add posters" picker, dropping and pasting. */
export function setUpImageImport() {
  elements.fileInput.onchange = () => {
    addPosters([...elements.fileInput.files]);
    elements.fileInput.value = ""; // so picking the same file again still triggers a change
  };

  elements.stage.addEventListener("dragenter", handleDragEnter);
  elements.stage.addEventListener("dragleave", handleDragLeave);
  elements.stage.addEventListener("dragover", (event) => {
    if (isExternalDrag(event)) event.preventDefault();
  });
  elements.stage.addEventListener("drop", handleDrop);

  document.addEventListener("paste", handlePaste);
}

// Adding, replacing, removing and moving posters
import { callServer, requestJson } from "./api.js";
import { MAX_STORED_POSTER_WIDTH } from "./config.js";
import { getActiveCategory, library, saveLibrary } from "./library.js";
import { render } from "./render.js";
import { showToast } from "./toast.js";
import { createId, plural } from "./utils.js";
import { refreshViewer } from "./viewer.js";

/**
 * Shrinks an image to at most MAX_STORED_POSTER_WIDTH wide and converts it to JPEG.
 * Smaller images keep their size.
 * @param {Blob} imageBlob - any image the browser can read
 * @returns {Promise<Blob>} the JPEG
 */
async function shrinkImage(imageBlob) {
  const bitmap = await createImageBitmap(imageBlob);
  const scale = Math.min(1, MAX_STORED_POSTER_WIDTH / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

/**
 * Saves images as new posters at the end of the open category.
 * Anything that isn't an image is ignored. Does nothing while the library is loading.
 * @param {Blob[]} imageBlobs - files or downloaded images
 */
export async function addPosters(imageBlobs) {
  if (!library) return;
  const images = imageBlobs.filter((blob) => blob?.type.startsWith("image/"));
  if (!images.length) return showToast("No images found");

  const category = getActiveCategory();
  let addedCount = 0;
  let lastErrorMessage = "";
  for (const image of images) {
    try {
      const file = `${createId()}.jpg`;
      await callServer(
        "PUT",
        "/api/poster",
        { folder: category.folder, file },
        await shrinkImage(image),
      );
      category.posters.push({ file });
      addedCount++;
    } catch (error) {
      console.error(error);
      lastErrorMessage = error.message;
    }
  }
  await saveLibrary();
  render();

  const failedCount = images.length - addedCount;
  if (!failedCount) return showToast(`Added ${plural(addedCount, "poster")}`);
  showToast(
    `Added ${addedCount}, ${failedCount} failed: ${lastErrorMessage}`,
    6000,
  );
}

/**
 * Replaces a poster's image, keeping its place in the grid. The new image gets
 * its own file name and the old one goes to the trash, so an Undo button is shown
 * and the old image can also be restored later from the Trash panel.
 * @param {string} file - the poster's current file name
 * @param {Blob} imageBlob - the new image
 */
export async function replacePosterImage(file, imageBlob) {
  const category = getActiveCategory();
  const folder = category.folder;
  const poster = category.posters.find((p) => p.file === file);
  if (!poster) return;

  const newFile = `${createId()}.jpg`;
  try {
    await callServer(
      "PUT",
      "/api/poster",
      { folder, file: newFile },
      await shrinkImage(imageBlob),
    );
  } catch (error) {
    console.error(error);
    return showToast(`Could not replace the poster: ${error.message}`, 6000);
  }
  try {
    await callServer("DELETE", "/api/poster", { folder, file });
  } catch (error) {
    // Without this, the new image would show up as an extra poster on the next load
    await callServer("DELETE", "/api/poster", { folder, file: newFile }).catch(
      () => {},
    );
    return showToast(`Could not replace the poster: ${error.message}`, 6000);
  }

  poster.file = newFile;
  await saveLibrary();
  render();
  refreshViewer();
  showToast("Replaced poster", 8000, {
    label: "Undo",
    onClick: () => undoReplacePoster(category.id, folder, file, newFile),
  });
}

/**
 * Undoes replacePosterImage: brings the old image back from the trash and moves
 * the new one to the trash.
 * @param {string} categoryId
 * @param {string} folder - the category's folder when the image was replaced
 * @param {string} oldFile
 * @param {string} newFile
 */
async function undoReplacePoster(categoryId, folder, oldFile, newFile) {
  const category = library.categories.find((c) => c.id === categoryId);
  const poster = category?.posters.find((p) => p.file === newFile);
  if (!poster) return showToast("That poster no longer exists", 5000);

  try {
    await callServer("POST", "/api/poster/restore", {
      folder,
      file: oldFile,
      to: category.folder,
    });
    await callServer("DELETE", "/api/poster", {
      folder: category.folder,
      file: newFile,
    });
  } catch (error) {
    console.error(error);
    return showToast(`Could not undo: ${error.message}`, 5000);
  }
  poster.file = oldFile;
  await saveLibrary();
  render();
  refreshViewer();
  showToast("Restored the previous image");
}

/**
 * Removes a poster from the open category. The server moves its file to
 * posters/.trash/<folder>/, and an Undo button is shown.
 * @param {string} file - the poster's file name
 */
export async function removePoster(file) {
  const category = getActiveCategory();
  const folder = category.folder;
  const position = category.posters.findIndex((p) => p.file === file);
  if (position < 0) return;

  try {
    await callServer("DELETE", "/api/poster", { folder, file });
  } catch (error) {
    console.error(error);
    return showToast("Could not remove the poster", 5000);
  }
  const [poster] = category.posters.splice(position, 1);
  await saveLibrary();
  render();
  showToast("Removed poster", 8000, {
    label: "Undo",
    onClick: () => restorePoster(category.id, folder, poster, position),
  });
}

/**
 * Undoes removePoster: moves the file back out of the trash and puts the poster
 * back where it was.
 * @param {string} categoryId - the category it was removed from
 * @param {string} removedFromFolder - that category's folder at the time
 * @param {Poster} poster
 * @param {number} position - where it was in the grid
 */
async function restorePoster(categoryId, removedFromFolder, poster, position) {
  const category = library.categories.find((c) => c.id === categoryId);
  if (!category) return showToast("That category no longer exists", 5000);

  try {
    await callServer("POST", "/api/poster/restore", {
      folder: removedFromFolder,
      file: poster.file,
      to: category.folder,
    });
  } catch (error) {
    console.error(error);
    return showToast(`Could not restore the poster: ${error.message}`, 5000);
  }
  category.posters.splice(position, 0, poster);
  await saveLibrary();
  render();
  showToast("Restored");
}

/**
 * Moves a poster from the open category to the end of another category.
 * @param {string} file - the poster's file name
 * @param {Category} targetCategory
 */
export async function movePoster(file, targetCategory) {
  const sourceCategory = getActiveCategory();
  const poster = sourceCategory.posters.find((p) => p.file === file);
  if (!poster) return;

  let message;
  try {
    // The server may rename the file if the target folder already has one with that name
    const { file: newFile } = await requestJson("POST", "/api/poster/move", {
      folder: sourceCategory.folder,
      file,
      to: targetCategory.folder,
    });
    sourceCategory.posters = sourceCategory.posters.filter((p) => p !== poster);
    targetCategory.posters.push({ ...poster, file: newFile });
    message = `Moved poster to ${targetCategory.name}`;
  } catch (error) {
    console.error(error);
    message = `Could not move the poster: ${error.message}`;
  }
  await saveLibrary();
  render(); // also undoes any half-finished drag reorder in the grid
  showToast(message, 4000);
}

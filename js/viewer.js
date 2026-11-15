// The popup that shows a poster larger
import { posterImageUrl } from "./api.js";
import { LOW_RESOLUTION_WIDTH } from "./config.js";
import { elements } from "./elements.js";
import { getActiveCategory } from "./library.js";

let shownPosition = -1; // position of the shown poster in the active category; -1 when closed

/**
 * Opens the popup on a poster of the open category, or moves it to that poster
 * if it is already open. Positions past either end wrap around. The caption notes
 * when the poster is narrower than LOW_RESOLUTION_WIDTH.
 * @param {number} position - the poster's position in the grid, starting at 0
 */
export function openViewer(position) {
  const category = getActiveCategory();
  const posterCount = category.posters.length;
  if (!posterCount) return closeViewer();

  shownPosition = (position + posterCount) % posterCount;
  const counterText = `${shownPosition + 1} / ${posterCount}`;
  elements.viewerCounter.textContent = counterText;
  elements.viewerImage.onload = () => {
    const { naturalWidth, naturalHeight } = elements.viewerImage;
    if (naturalWidth < LOW_RESOLUTION_WIDTH) {
      elements.viewerCounter.textContent = `${counterText} · low resolution (${naturalWidth} × ${naturalHeight} px)`;
    }
  };
  elements.viewerImage.src = posterImageUrl(
    category,
    category.posters[shownPosition],
  );
  elements.viewerPreviousButton.hidden = posterCount < 2;
  elements.viewerNextButton.hidden = posterCount < 2;
  elements.viewer.hidden = false;
}

/**
 * The file name of the poster shown in the popup.
 * @returns {string | null} null when the popup is closed
 */
export function getShownPosterFile() {
  if (elements.viewer.hidden || shownPosition < 0) return null;
  return getActiveCategory().posters[shownPosition]?.file ?? null;
}

/** Shows the popup's poster again, e.g. after its image was replaced. Does nothing when closed. */
export function refreshViewer() {
  if (!elements.viewer.hidden) openViewer(shownPosition);
}

/** Closes the popup. */
function closeViewer() {
  elements.viewer.hidden = true;
  shownPosition = -1;
  elements.viewerImage.removeAttribute("src");
}

/** Shows the previous poster in the popup (the last one after the first). */
const showPreviousPoster = () => openViewer(shownPosition - 1);

/** Shows the next poster in the popup (the first one after the last). */
const showNextPoster = () => openViewer(shownPosition + 1);

/**
 * Connects the popup's buttons and keys: ‹ › and the arrow keys move between posters;
 * ×, Escape and clicking the dark backdrop close it.
 */
export function setUpViewer() {
  elements.viewer.onclick = (event) => {
    if (event.target === elements.viewer) closeViewer();
  };
  elements.viewerCloseButton.onclick = closeViewer;
  elements.viewerPreviousButton.onclick = showPreviousPoster;
  elements.viewerNextButton.onclick = showNextPoster;

  document.addEventListener("keydown", (event) => {
    if (elements.viewer.hidden) return;
    if (event.key === "Escape") closeViewer();
    else if (event.key === "ArrowLeft") showPreviousPoster();
    else if (event.key === "ArrowRight") showNextPoster();
  });
}

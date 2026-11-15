// Short messages at the bottom of the page
import { elements } from "./elements.js";

let hideTimer;

/**
 * Shows a short message at the bottom of the page, which hides itself after a while.
 * @param {string} message
 * @param {number} [durationMs=2500] - how long it stays visible
 * @param {{ label: string, onClick: () => void }} [action] - an optional button, e.g. Undo
 */
export function showToast(message, durationMs = 2500, action) {
  const toast = elements.toast;
  toast.replaceChildren(message);
  if (action) {
    const button = document.createElement("button");
    button.className = "toast-action";
    button.textContent = action.label;
    button.onclick = () => {
      toast.classList.remove("show");
      action.onClick();
    };
    toast.append(button);
  }
  toast.classList.add("show");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.remove("show"), durationMs);
}

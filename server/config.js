// Settings for the server: where things are stored and how big they may be
const path = require("path");

const PORT = 9153;
const HOST = "127.0.0.1";

const APP_FOLDER = path.join(__dirname, "..");
const POSTERS_FOLDER = path.join(APP_FOLDER, "posters");
const LIBRARY_FILE = path.join(POSTERS_FOLDER, "library.json");
const EXPORTS_FOLDER = path.join(APP_FOLDER, "exports");

// Removed posters go to .trash/<folder>/<file>; removed categories to .trash/.categories/<stamp>-<folder>.
const TRASH_FOLDER = path.join(POSTERS_FOLDER, ".trash");
const CATEGORY_TRASH_FOLDER = path.join(TRASH_FOLDER, ".categories");

const MB = 1024 * 1024;
const MAX_UPLOAD_SIZE = 5 * MB;
const MAX_EXPORT_SIZE = 100 * MB;
const MAX_DOWNLOAD_SIZE = 25 * MB;
const DOWNLOAD_TIMEOUT_MS = 20000;

const POSTER_FILE_PATTERN = /\.(jpe?g|png|webp)$/i;
const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

module.exports = {
  PORT,
  HOST,
  APP_FOLDER,
  POSTERS_FOLDER,
  LIBRARY_FILE,
  EXPORTS_FOLDER,
  TRASH_FOLDER,
  CATEGORY_TRASH_FOLDER,
  MAX_UPLOAD_SIZE,
  MAX_EXPORT_SIZE,
  MAX_DOWNLOAD_SIZE,
  DOWNLOAD_TIMEOUT_MS,
  POSTER_FILE_PATTERN,
  CONTENT_TYPES,
};

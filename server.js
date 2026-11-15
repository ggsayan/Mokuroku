// Mokuroku local server: serves the app and saves posters into ./posters

const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = 9153;
const ROOT = __dirname;
const POSTERS = path.join(ROOT, "posters");
const LIBRARY = path.join(POSTERS, "library.json");
const EXPORTS = path.join(ROOT, "exports");
const TRASH = path.join(POSTERS, ".trash");
const CATEGORY_TRASH = path.join(TRASH, ".categories");
const IMAGE_RE = /\.(jpe?g|png|webp)$/i;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
};

/**
 * Creates an error that is sent to the browser with the given HTTP status.
 * @param {number} status - e.g. 400, 404
 * @param {string} message - shown to the user
 * @returns {Error & { status: number }}
 */
const httpError = (status, message) =>
  Object.assign(new Error(message), { status });

/**
 * Whether a folder or file name is safe to use: not empty, not too long, no
 * characters Windows forbids, and not "." or ".." (which could escape the folder).
 * @param {unknown} s
 * @returns {boolean}
 */
const isSafeName = (s) =>
  typeof s === "string" &&
  s.length > 0 &&
  s.length < 200 &&
  !/[<>:"/\\|?*\x00-\x1f]/.test(s) &&
  s !== "." &&
  s !== "..";

/**
 * Sends a response. Objects are sent as JSON; text and binary data as they are.
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {object | string | Buffer} body
 * @param {string} [type] - the Content-Type
 */
function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(
    Buffer.isBuffer(body) || typeof body === "string"
      ? body
      : JSON.stringify(body),
  );
}

/**
 * Reads the whole uploaded body of a request.
 * @param {http.IncomingMessage} req
 * @param {number} [limit] - maximum size in bytes (25 MB by default)
 * @returns {Promise<Buffer>}
 * @throws a 413 error if the body is larger than the limit
 */
function readBody(req, limit = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(httpError(413, "File too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Lists the images in every category folder under posters/.
 * Hidden folders such as .trash are skipped. Creates posters/ if it is missing.
 * @returns {Promise<Record<string, string[]>>} { "<folder>": ["file1.jpg", ...] }
 */
async function scanDisk() {
  await fs.mkdir(POSTERS, { recursive: true });
  const disk = {};
  for (const d of await fs.readdir(POSTERS, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith(".")) continue; // skip .trash etc.
    const files = await fs.readdir(path.join(POSTERS, d.name), {
      withFileTypes: true,
    });
    disk[d.name] = files
      .filter((f) => f.isFile() && IMAGE_RE.test(f.name))
      .map((f) => f.name)
      .sort();
  }
  return disk;
}

/**
 * Handles every /api/... request: reading and saving the library, and creating,
 * moving, trashing and restoring folders and posters. See each case below.
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} url - the request's address, with ?key=value parameters
 * @throws an httpError for bad requests, which the caller sends to the browser
 */
async function api(req, res, url) {
  // Custom header forces a CORS preflight, so other websites can't change your files.
  if (req.method !== "GET" && req.headers["x-mokuroku"] !== "1")
    throw httpError(403, "Forbidden");

  const q = Object.fromEntries(url.searchParams);

  /** Checks a category folder name (?folder= by default) and returns it. */
  const folderName = (name = q.folder) => {
    if (!isSafeName(name) || name.startsWith("."))
      throw httpError(400, "Invalid folder name");
    return name;
  };

  /** Full path of a category folder (?folder= by default). */
  const folderPath = (name) => path.join(POSTERS, folderName(name));

  /** Checks the ?file= image name and returns it. */
  const fileName = () => {
    if (!isSafeName(q.file) || !IMAGE_RE.test(q.file))
      throw httpError(400, "Invalid file name");
    return q.file;
  };

  /** Full path of the poster named by ?folder= and ?file=. */
  const posterPath = () => path.join(folderPath(), fileName());

  /** Where that poster goes in the trash: posters/.trash/<folder>/<file>. */
  const trashPath = () => path.join(TRASH, folderName(), fileName());

  /** Whether a file or folder exists. */
  const exists = (p) =>
    fs.access(p).then(
      () => true,
      () => false,
    );

  /** Answers { ok: true }. */
  const ok = () => send(res, 200, { ok: true });

  switch (`${req.method} ${url.pathname}`) {
    case "GET /api/library": {
      let library = null;
      try {
        library = JSON.parse(await fs.readFile(LIBRARY, "utf8"));
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
      return send(res, 200, { library, disk: await scanDisk() });
    }
    case "PUT /api/library": {
      const body = await readBody(req);
      JSON.parse(body); // reject invalid JSON
      await fs.mkdir(POSTERS, { recursive: true });
      await fs.writeFile(LIBRARY + ".tmp", body);
      await fs.rename(LIBRARY + ".tmp", LIBRARY); // atomic replace
      return ok();
    }
    case "POST /api/folder":
      await fs.mkdir(folderPath(), { recursive: true });
      return ok();
    case "DELETE /api/folder": {
      // Removed categories go to posters/.trash/.categories/<stamp>-<folder> so they can be
      // restored. The leading dot keeps it apart from per-poster trash folders.
      const from = folderPath();
      if (!(await exists(from))) return send(res, 200, { ok: true, trashed: null });
      const trashed = `${Date.now().toString(36)}-${folderName()}`;
      await fs.mkdir(CATEGORY_TRASH, { recursive: true });
      await fs.rename(from, path.join(CATEGORY_TRASH, trashed));
      return send(res, 200, { ok: true, trashed });
    }
    case "POST /api/folder/restore": {
      // ?trashed=<name returned by DELETE /api/folder>&folder=<folder to restore as>
      if (!isSafeName(q.trashed)) throw httpError(400, "Invalid trash name");
      const from = path.join(CATEGORY_TRASH, q.trashed);
      const to = folderPath();
      if (!(await exists(from))) throw httpError(404, "Not in trash any more");
      if (await exists(to))
        throw httpError(409, "A folder with that name already exists");
      await fs.rename(from, to);
      return ok();
    }
    case "PUT /api/poster": {
      const file = posterPath();
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, await readBody(req));
      return ok();
    }
    case "DELETE /api/poster": {
      // Moved to posters/.trash/<folder>/<file> so it can be restored
      const from = posterPath(),
        to = trashPath();
      if (await exists(from)) {
        await fs.mkdir(path.dirname(to), { recursive: true });
        await fs.rename(from, to);
      }
      return ok();
    }
    case "POST /api/poster/restore": {
      // ?folder=<folder it was removed from>&file=<file>&to=<folder to restore into>
      const from = trashPath();
      const to = path.join(folderPath(q.to), fileName());
      if (!(await exists(from))) throw httpError(404, "Not in trash any more");
      if (await exists(to))
        throw httpError(409, "A poster with that name already exists");
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return ok();
    }
    case "POST /api/poster/move": {
      // ?folder=<from>&file=<file>&to=<folder>; returns the (possibly renamed) file
      const from = posterPath();
      const dir = folderPath(q.to);
      let name = fileName();
      if (await exists(path.join(dir, name))) {
        name = `${Date.now().toString(36)}-${name}`; // avoid overwriting a same-named file
      }
      await fs.mkdir(dir, { recursive: true });
      await fs.rename(from, path.join(dir, name));
      return send(res, 200, { ok: true, file: name });
    }
    case "POST /api/fetch": {
      // Downloads an image dragged in from another site (the browser can't, because of CORS)
      let target;
      try {
        target = new URL(q.url);
      } catch {
        throw httpError(400, "Invalid URL");
      }
      if (!/^https?:$/.test(target.protocol))
        throw httpError(400, "Only http(s) links are supported");
      let r;
      try {
        r = await fetch(target, {
          redirect: "follow",
          signal: AbortSignal.timeout(20000),
          headers: {
            "User-Agent": "Mozilla/5.0 (Mokuroku poster shelf)",
            Accept: "image/*,*/*;q=0.5",
            Referer: target.origin + "/",
          },
        });
      } catch {
        throw httpError(502, "Could not reach that site");
      }
      if (!r.ok) throw httpError(502, `The site answered ${r.status}`);
      const type = (r.headers.get("content-type") || "").split(";")[0].trim();
      if (!type.startsWith("image/"))
        throw httpError(415, "That link is not an image");
      const data = Buffer.from(await r.arrayBuffer());
      if (data.length > 25 * 1024 * 1024)
        throw httpError(413, "Image too large");
      return send(res, 200, data, type);
    }
    case "PUT /api/export": {
      if (!isSafeName(q.file) || !/\.png$/i.test(q.file))
        throw httpError(400, "Invalid file name");
      await fs.mkdir(EXPORTS, { recursive: true });
      const file = path.join(EXPORTS, q.file);
      await fs.writeFile(file, await readBody(req, 200 * 1024 * 1024));
      return send(res, 200, { ok: true, path: file });
    }
  }
  throw httpError(404, "Unknown API route");
}

/**
 * Sends a file from the app folder (index.html, js/, style.css, poster images…).
 * Refuses paths that would reach outside the app folder.
 * @param {http.ServerResponse} res
 * @param {URL} url
 * @throws a 403 error for paths outside the app folder, 404 if the file doesn't exist
 */
async function serveStatic(res, url) {
  const rel = decodeURIComponent(
    url.pathname === "/" ? "/index.html" : url.pathname,
  );
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep)) throw httpError(403, "Forbidden");
  let data;
  try {
    data = await fs.readFile(file);
  } catch {
    throw httpError(404, "Not found");
  }
  send(
    res,
    200,
    data,
    TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
  );
}

// Every request goes to api() or serveStatic(); any error becomes a JSON { error } answer
http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD")
        throw httpError(405, "Method not allowed");
      await serveStatic(res, url);
    } catch (err) {
      if (!err.status) console.error(err);
      send(res, err.status || 500, { error: err.message });
    }
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Mokuroku running at http://127.0.0.1:${PORT}`);
    console.log(`Posters are saved in ${POSTERS}/`);
    console.log(`PNG exports are saved in ${EXPORTS}/`);
    console.log("Press Ctrl+C to stop.");
  });

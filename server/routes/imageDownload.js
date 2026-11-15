// API route that downloads images from other websites for the browser
const { DOWNLOAD_TIMEOUT_MS, MAX_DOWNLOAD_SIZE } = require("../config");
const { httpError, sendResponse } = require("../httpHelpers");

/**
 * POST /api/fetch?url= — downloads an image from another website and passes it on.
 * The browser can't do this itself, because websites block requests from other sites (CORS).
 */
async function downloadImage({ response, query }) {
  let address;
  try {
    address = new URL(query.url);
  } catch {
    throw httpError(400, "Invalid URL");
  }
  if (!/^https?:$/.test(address.protocol)) {
    throw httpError(400, "Only http(s) links are supported");
  }

  let download;
  try {
    download = await fetch(address, {
      redirect: "follow",
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (Mokuroku poster shelf)",
        Accept: "image/*,*/*;q=0.5",
        Referer: address.origin + "/", // some sites refuse images requested without one
      },
    });
  } catch {
    throw httpError(502, "Could not reach that site");
  }
  if (!download.ok) {
    throw httpError(502, `The site answered ${download.status}`);
  }

  const contentType = (download.headers.get("content-type") || "")
    .split(";")[0]
    .trim();
  if (!contentType.startsWith("image/")) {
    throw httpError(415, "That link is not an image");
  }
  const image = Buffer.from(await download.arrayBuffer());
  if (image.length > MAX_DOWNLOAD_SIZE) throw httpError(413, "Image too large");
  sendResponse(response, 200, image, contentType);
}

module.exports = { downloadImage };

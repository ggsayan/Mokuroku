// Finding the best-quality address for an image dragged in from a website.
// Pages usually show a reduced copy, so this looks for larger versions first.

/**
 * Picks the largest image from a srcset attribute, e.g.
 * "small.jpg 300w, big.jpg 1200w" → "big.jpg", or "a.jpg 1x, b.jpg 2x" → "b.jpg".
 * @param {string | null} srcset
 * @returns {string | null}
 */
function largestFromSrcset(srcset) {
  if (!srcset) return null;
  // Each entry is an address (which may itself contain commas) and an optional "300w" or "2x"
  const entryPattern = /\s*(\S+)(?:\s+([\d.]+)([wx]))?\s*(?:,|$)/g;
  let best = null;
  let bestSize = -1;
  for (const [, address, number, unit] of srcset.matchAll(entryPattern)) {
    const size = number ? Number(number) * (unit === "x" ? 1000 : 1) : 0;
    if (size > bestSize) {
      best = address.replace(/,+$/, "");
      bestSize = size;
    }
  }
  return best;
}

/**
 * Larger versions of a thumbnail address on sites whose addresses say the size.
 * @param {string} address
 * @returns {string[]} best first; empty for other sites
 */
function fullSizeVersions(address) {
  let url;
  try {
    url = new URL(address);
  } catch {
    return [];
  }
  /** The same address with a different path, optionally without its ?query. */
  const withPath = (pathname, keepQuery = true) => {
    const copy = new URL(url);
    copy.pathname = pathname;
    if (!keepQuery) copy.search = "";
    return copy.href;
  };
  const host = url.hostname;
  const versions = [];

  if (host === "image.tmdb.org") {
    // /t/p/w300/abc.jpg → /t/p/original/abc.jpg
    versions.push(withPath(url.pathname.replace(/^\/t\/p\/[^/]+\//, "/t/p/original/")));
  }
  if (host === "cdn.myanimelist.net") {
    // /r/50x70/images/anime/1/123t.jpg → /images/anime/1/123l.jpg ("l" is the large copy).
    // The ?query only belongs to the resized copy, so it is dropped.
    const unresized = url.pathname.replace(/^\/r\/\d+x\d+\//, "/");
    const large = unresized.replace(/^(.*\/\d+)[tl]?(\.\w+)$/, "$1l$2");
    versions.push(withPath(large, false), withPath(unresized, false));
  }
  if (host.endsWith("anilist.co")) {
    // .../cover/small/bx21.jpg or /medium/ → /large/ (AniList's biggest cover)
    versions.push(withPath(url.pathname.replace(/\/cover\/(small|medium)\//, "/cover/large/")));
  }
  if (host === "m.media-amazon.com" || host.endsWith(".media-amazon.com")) {
    // IMDb: abc._V1_UX182_CR0,3,182,268_AL_.jpg → abc._V1_.jpg (full size)
    versions.push(withPath(url.pathname.replace(/\._V1_.*(\.\w+)$/, "._V1_$1")));
  }
  return versions.filter((version) => version !== address);
}

/**
 * Turns an address from the dropped HTML into a full address.
 * @param {string | null} address - may be relative
 * @param {string} baseAddress - what relative addresses are relative to
 * @returns {string | null}
 */
function toFullAddress(address, baseAddress) {
  if (!address) return null;
  try {
    return new URL(address.trim(), baseAddress || undefined).href;
  } catch {
    return null;
  }
}

/**
 * Every address the dragged <img> offers, best first: the largest srcset entry,
 * <source> entries around it, the real address on pages that load images while
 * scrolling (data-src etc.), and finally its src.
 * @param {HTMLImageElement} image - from the dropped HTML
 * @param {string} pageAddress - the dragged link or page, used for relative addresses
 * @returns {string[]}
 */
function addressesFromImage(image, pageAddress) {
  const src = image.getAttribute("src");
  const base = /^https?:/.test(src ?? "") ? src : pageAddress;
  const sourceSets = [...image.closest("picture")?.querySelectorAll("source") ?? []]
    .map((source) => largestFromSrcset(source.getAttribute("srcset")));
  const found = [
    largestFromSrcset(image.getAttribute("srcset")),
    largestFromSrcset(image.getAttribute("data-srcset")),
    ...sourceSets,
    image.getAttribute("data-src"),
    image.getAttribute("data-original"),
    image.getAttribute("data-lazy-src"),
    src,
  ];
  return found.map((address) => toFullAddress(address, base)).filter(Boolean);
}

/**
 * The addresses to try for an image dragged out of another browser window, best
 * quality first. Ends with the address the page was actually showing, so the
 * caller can fall back to it if the larger ones can't be downloaded.
 * @param {DataTransfer} dataTransfer
 * @returns {string[]} empty if nothing usable was dragged
 */
export function getDroppedImageAddresses(dataTransfer) {
  // text/uri-list is often the link around the image (e.g. a search result), so the
  // <img> in text/html is preferred, and the link is only used as a last resort
  const linkAddress = dataTransfer
    .getData("text/uri-list")
    .split(/\r?\n/)
    .find((line) => line && !line.startsWith("#"));
  const plainText = dataTransfer.getData("text/plain").trim();

  let addresses = [];
  const html = dataTransfer.getData("text/html");
  if (html) {
    const image = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("img");
    if (image) addresses = addressesFromImage(image, linkAddress);
  }
  if (!addresses.length && linkAddress) addresses = [linkAddress];
  if (!addresses.length && /^(https?|data):/.test(plainText)) addresses = [plainText];

  const withFullSizes = addresses.flatMap((address) => [
    ...fullSizeVersions(address),
    address,
  ]);
  return [...new Set(withFullSizes)];
}

// Requests to the local server (server.js)

/**
 * Sends a request to the local server and throws if it fails.
 * The custom header is required by server.js for every request that changes files.
 * @param {string} method - "GET", "PUT", "POST" or "DELETE"
 * @param {string} route - e.g. "/api/poster"
 * @param {Record<string, string>} [params] - added to the URL as ?key=value
 * @param {BodyInit} [body] - data to upload, such as JSON text or an image
 * @returns {Promise<Response>}
 * @throws {Error} with the server's error message when the request fails
 */
export async function callServer(method, route, params, body) {
  const url = params ? `${route}?${new URLSearchParams(params)}` : route;
  const response = await fetch(url, {
    method,
    body,
    headers: { "X-Mokuroku": "1" },
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      message = (await response.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return response;
}

/**
 * Same as callServer, but returns the server's JSON answer.
 * @returns {Promise<any>}
 */
export const requestJson = async (...args) =>
  (await callServer(...args)).json();

/**
 * The address of a poster's image file on the server.
 * @param {Category} category
 * @param {Poster} poster
 * @returns {string} e.g. "/posters/Anime%20Series/abc.jpg"
 */
export const posterImageUrl = (category, poster) =>
  `/posters/${encodeURIComponent(category.folder)}/${encodeURIComponent(poster.file)}`;

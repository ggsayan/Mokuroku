// Settings for the browser app: defaults, image sizes and the look of PNG exports

export const DEFAULT_CATEGORY_NAMES = [
  "Anime Series",
  "Anime Movies",
  "TV Series",
];
export const DEFAULT_COLUMNS = 6;
export const MAX_STORED_POSTER_WIDTH = 800; // big enough to stay sharp in the popup
export const LOW_RESOLUTION_WIDTH = 400; // posters narrower than this get a "Low res" badge

export const EXPORT_LAYOUT = {
  posterWidth: 360,
  posterHeight: 540,
  gap: 20,
  padding: 48,
  headerHeight: 110,
  cornerRadius: 14,
};
export const EXPORT_COLORS = {
  background: "#000000",
  title: "#ededed",
  subtitle: "#8c8c8c",
};
export const EXPORT_FONT = 'system-ui, "Segoe UI", sans-serif';

// Largest canvas browsers can draw
export const CANVAS_MAX_SIDE = 32767;
export const CANVAS_MAX_AREA = 268e6;

// The page elements the scripts work with, looked up once

/**
 * Finds an element in index.html by its id.
 * @param {string} id
 * @returns {HTMLElement}
 */
const byId = (id) => document.getElementById(id);

/** Every element from index.html that the scripts use. */
export const elements = {
  tabs: byId("tabs"),
  stage: byId("stage"),
  grid: byId("grid"),
  emptyMessage: byId("empty"),
  fileInput: byId("fileInput"),
  columnsSlider: byId("cols"),
  columnsValue: byId("colsOut"),
  exportScaleSelect: byId("exportScale"),
  exportButton: byId("exportPng"),
  exportAllButton: byId("exportAll"),
  contextMenu: byId("menu"),
  toast: byId("toast"),
  serverNotice: byId("notice"),
  viewer: byId("viewer"),
  viewerImage: byId("viewerImg"),
  viewerCounter: byId("viewerCount"),
  viewerPreviousButton: byId("viewerPrev"),
  viewerNextButton: byId("viewerNext"),
  viewerCloseButton: byId("viewerClose"),
  trashButton: byId("trashButton"),
  trashDialog: byId("trashDialog"),
  trashContent: byId("trashContent"),
  trashCloseButton: byId("trashClose"),
};

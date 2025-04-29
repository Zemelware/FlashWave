import browser from "webextension-polyfill";

// Listens for messages from the background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SHOW_ERROR") {
    alert(`FlashWave Error: ${request.message}`);
  } else if (request.type === "SHOW_SUCCESS") {
    alert(`FlashWave: ${request.message}`);
  }
  // For Firefox compatibility with async listeners
  return Promise.resolve(false);
});

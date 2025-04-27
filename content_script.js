// Listens for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "SHOW_ERROR") {
    alert(`FlashWave Error: ${request.message}`);
  } else if (request.type === "SHOW_SUCCESS") {
    alert(`FlashWave: ${request.message}`);
  }
});

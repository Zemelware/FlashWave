async function getApiKey() {
  const result = await chrome.storage.sync.get(["apiKey"]);
  if (result.apiKey) {
    return result.apiKey;
  } else {
    return null;
  }
}

// Create context menu item on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "generateFlashcards",
    title: "Generate Flashcards with AI",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "generateFlashcards" && info.selectionText) {
    const apiKey = await getApiKey();
    const originalTabId = tab.id;

    if (!apiKey) {
      if (originalTabId) {
        chrome.tabs.sendMessage(originalTabId, {
          type: "SHOW_ERROR",
          message: "Gemini API Key not configured. Please set it in the extension settings.",
        });
      }
      return;
    }

    await setupOffscreenDocument("offscreen.html");
    chrome.runtime
      .sendMessage({
        type: "generate-flashcards",
        target: "offscreen",
        data: {
          selectedText: info.selectionText,
          apiKey: apiKey,
          originalTabId: originalTabId,
        },
      })
      .catch((error) => {
        console.error("Error sending 'generate-flashcards' message to offscreen document:", error);
        if (originalTabId) {
          chrome.tabs.sendMessage(originalTabId, {
            type: "SHOW_ERROR",
            message: `There was an error generating flashcards.`,
          });
        }
      });
  }
});

let creating; // A global promise to avoid concurrency issues
async function setupOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ["DOM_PARSER"],
      justification: "Needed to call the Gemini API",
    });
    await creating;
    creating = null;
  }
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.target !== "background") {
    return false; // Ignore messages not intended for the background script
  }

  const originalTabId = message.data?.originalTabId;

  if (message.type === "flashcards-generated") {
    // TODO: Display flashcards to the user (e.g., new tab, inject into page)
    console.log("--- Generated Flashcards --- ");
    console.log(message.data.flashcardsText);
    console.log("-----------------------------");

    // Notify the original content script about success
    chrome.tabs.sendMessage(originalTabId, {
      type: "SHOW_SUCCESS",
      message: "Flashcards generated! Check the console.",
    });
  } else if (message.type === "generation-error") {
    console.error("Error generating flashcards:", message.error);
    chrome.tabs.sendMessage(originalTabId, {
      type: "SHOW_ERROR",
      message: `Error: ${message.error}`,
    });
  }
  // Indicate async handling is possible
  return true;
});

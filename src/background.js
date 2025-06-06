import browser from "webextension-polyfill";
import { streamFlashcardsFromLLM } from "./llm-service.js";

// Helper to show an alert pop-up in the specified tab
async function showAlert(tabId, message) {
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: (msg) => alert(msg),
      args: [message],
    });
  } catch (e) {
    console.error(`Failed to send alert to tab ${tabId}:`, e);
  }
}

// Track ports for flashcards streaming by tabId
const flashcardPorts = new Map();

// Listen for connection from flashcards page
browser.runtime.onConnect.addListener((port) => {
  if (port.name === "flashcards-stream" && port.sender?.tab?.id != null) {
    const tabId = port.sender.tab.id;
    // If a port already exists for this tab, disconnect the old one first
    if (flashcardPorts.has(tabId)) {
      try {
        flashcardPorts.get(tabId).disconnect();
      } catch (e) {
        console.warn(`Error disconnecting old port for tab ${tabId}:`, e.message);
      }
    }
    flashcardPorts.set(tabId, port);
    port.onDisconnect.addListener(() => {
      console.log(`Port disconnected for tab ${tabId}`);
      if (flashcardPorts.get(tabId) === port) {
        flashcardPorts.delete(tabId);
      }
    });
    console.log(`Port connected and stored for tab ${tabId}`);
  }
});

async function getApiKeyAndModel() {
  const result = await browser.storage.sync.get(["apiKey", "llmModel"]);
  return {
    apiKey: result.apiKey || null,
    llmModel: result.llmModel || null,
  };
}

// Create context menu item on installation
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "generateFlashcards",
    title: "Generate Flashcards with AI",
    contexts: ["selection"],
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "generateFlashcards" && info.selectionText) {
    const storage = await getApiKeyAndModel();
    const originalTabId = tab.id;

    if (!storage.apiKey) {
      showAlert(
        originalTabId,
        "Gemini API Key not configured. Please set it in the extension settings."
      );
      return;
    }

    // Call the new streaming function
    await generateFlashcardsStream({
      selectedText: info.selectionText,
      apiKey: storage.apiKey,
      originalTabId: originalTabId,
      llmModel: storage.llmModel,
    });
  }
});

/**
 * Stream flashcards generation and display in real time.
 */
async function generateFlashcardsStream({ selectedText, apiKey, originalTabId, llmModel }) {
  // Open or focus flashcards page
  const flashcardsUrl = browser.runtime.getURL("flashcards/flashcards.html");
  let targetTab = null;
  const tabs = await browser.tabs.query({ url: flashcardsUrl });
  if (tabs.length > 0) {
    targetTab = tabs[0];
    await browser.tabs.update(targetTab.id, { active: true });
    if (targetTab.windowId) {
      await browser.windows.update(targetTab.windowId, { focused: true });
    }
  } else {
    targetTab = await browser.tabs.create({ url: flashcardsUrl });
  }
  const tabId = targetTab.id;

  let port = flashcardPorts.get(tabId);
  let connectionAttempts = 0;
  const maxAttempts = 2; // Try initial wait + one reconnect attempt

  while (!port && connectionAttempts < maxAttempts) {
    console.log(`Attempt ${connectionAttempts + 1}/${maxAttempts} to get port for tab ${tabId}.`);

    if (connectionAttempts > 0) {
      // If this is not the first attempt, request reconnect from the content script
      try {
        await browser.tabs.sendMessage(tabId, { type: "REQUEST_RECONNECT" });
        // Add a small delay to allow the port connection to establish
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (e) {
        console.warn(`Failed to send/receive REQUEST_RECONNECT to tab ${tabId}:`, e.message);
        break;
      }
    }

    // Wait for the port to be established (either initially or after reconnect request)
    for (let i = 0; i < 5; i++) {
      port = flashcardPorts.get(tabId);
      if (port) {
        console.log(`Port acquired for tab ${tabId} on attempt ${connectionAttempts + 1}.`);
        break;
      }
      await new Promise((res) => setTimeout(res, 200));
    }

    if (port) {
      break;
    }

    connectionAttempts++;
  }

  if (!port) {
    console.error(`No streaming port connected for tab ${tabId} after ${maxAttempts} attempts.`);
    showAlert(
      tabId,
      "Could not connect to the Flashcards page for streaming. Please reload the page and try again."
    );
    return;
  }

  // Notify UI to prepare for stream
  port.postMessage({ type: "STREAM_START" });

  try {
    let setName = null;
    let flashcards = [];
    // Track which cards have already been sent (by index)
    let sentCardIndexes = new Set();

    for await (const parsed of streamFlashcardsFromLLM(selectedText, apiKey, llmModel)) {
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.setName &&
        Array.isArray(parsed.flashcards)
      ) {
        if (!setName) {
          setName = parsed.setName;
          port.postMessage({ type: "STREAM_SETNAME", setName });
        }
        // For each card, only send if it's new or updated and fully formed
        for (let i = 0; i < parsed.flashcards.length; ++i) {
          const card = parsed.flashcards[i];
          if (card.term && card.definition) {
            // If this card is new or has changed, send it
            if (
              !flashcards[i] ||
              flashcards[i].term !== card.term ||
              flashcards[i].definition !== card.definition
            ) {
              flashcards[i] = card;
              if (!sentCardIndexes.has(i)) {
                port.postMessage({ type: "STREAM_CARD", card });
                sentCardIndexes.add(i);
              }
            }
          }
        }
      }
    }

    // Save the successfully generated flashcards
    if (setName && flashcards.length > 0) {
      const finalSetName = await saveAndShowFlashcards(setName, flashcards, originalTabId);
      port.postMessage({ type: "STREAM_COMPLETE", setName: finalSetName });
    } else {
      throw new Error("Invalid response structure received from the LLM.");
    }
  } catch (error) {
    console.error("Error streaming or parsing flashcards:", error);

    let msg;
    // Try to extract the specific error from the Gemini API
    const match = error.message.match(/{.*}/s);
    if (match) {
      try {
        const parsedError = JSON.parse(match[0]);
        if (parsedError.error && parsedError.error.message) {
          let errorMessage = parsedError.error.message;
          errorMessage = JSON.parse(errorMessage);
          msg = `There was an error from the Gemini API when generating flashcards:<br>${errorMessage.error.message}`;
        }
      } catch (e) {
        // If the above failed, then the error is not from the Gemini API, in which case
        // we show a generic error message
        msg = "Error generating flashcards. Check the console for the full error message.";
      }
    }

    if (port) {
      port.postMessage({
        type: "STREAM_ERROR",
        message: msg,
      });
    }
  }
}

async function saveAndShowFlashcards(setName, flashcards, originalTabId) {
  try {
    const storageResult = await browser.storage.local.get("flashcardSets");
    const allSets = storageResult.flashcardSets || {};

    let finalSetName = setName;
    let counter = 1;
    // Check if the initial name exists and find the next available numbered name
    while (allSets.hasOwnProperty(finalSetName)) {
      finalSetName = `${setName} (${counter})`;
      counter++;
    }

    allSets[finalSetName] = flashcards;

    await browser.storage.local.set({ flashcardSets: allSets });

    // Check for existing flashcards tab
    const flashcardsUrl = browser.runtime.getURL("flashcards/flashcards.html");
    const existingTabs = await browser.tabs.query({ url: flashcardsUrl });
    for (const tab of existingTabs) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          type: "FLASHCARDS_UPDATED",
          newSetName: finalSetName,
        });
      } catch (e) {
        console.warn(`Could not send FLASHCARDS_UPDATED to tab ${tab.id}: ${e.message}`);
      }
    }
    return finalSetName;
  } catch (error) {
    console.error("Error storing flashcards:", error);
    showAlert(originalTabId, "Error saving flashcards: " + error.message);
  }
}

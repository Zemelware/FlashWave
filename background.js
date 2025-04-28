import browser from "webextension-polyfill";

async function getApiKey() {
  const result = await browser.storage.sync.get(["apiKey"]);
  if (result.apiKey) {
    return result.apiKey;
  } else {
    return null;
  }
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
    const apiKey = await getApiKey();
    const originalTabId = tab.id;

    if (!apiKey) {
      if (originalTabId) {
        try {
          await browser.tabs.sendMessage(originalTabId, {
            type: "SHOW_ERROR",
            message: "Gemini API Key not configured. Please set it in the extension settings.",
          });
        } catch (error) {
          console.warn(`Could not send message to tab ${originalTabId}: ${error.message}`);
        }
      }
      return;
    }

    try {
      await generateFlashcards({
        selectedText: info.selectionText,
        apiKey: apiKey,
        originalTabId: originalTabId,
      });
    } catch (error) {
      console.error("Error generating flashcards in background:", error);
      if (originalTabId) {
        try {
          await browser.tabs.sendMessage(originalTabId, {
            type: "SHOW_ERROR",
            message: "There was an error generating flashcards.",
          });
        } catch (sendError) {
          console.warn(
            `Could not send error message to tab ${originalTabId}: ${sendError.message}`
          );
        }
      }
    }
  }
});

async function generateFlashcards({ selectedText, apiKey, originalTabId }) {
  const { GoogleGenAI } = await import("@google/genai");
  if (!apiKey) throw new Error("API Key is missing.");
  if (!selectedText) throw new Error("Selected text is missing.");
  const genAI = new GoogleGenAI({ apiKey });
  const prompt = `Generate 3-5 flashcards (simple question and answer pairs) based on the following text. Format each flashcard as 'Q: [question]\nA: [answer]' and separate flashcards with a double newline:

<text>
${selectedText}
</text>
`;

  const result = await genAI.models.generateContent({
    model: "gemini-2.5-flash-preview-04-17",
    contents: prompt,
  });
  const flashcardsText = result.text;

  if (originalTabId) {
    try {
      await browser.tabs.sendMessage(originalTabId, {
        type: "SHOW_SUCCESS",
        message: "Flashcards generated! Check the console.",
      });
    } catch (error) {
      console.warn(`Could not send success message to tab ${originalTabId}: ${error.message}`);
    }
  }
  console.log("--- Generated Flashcards ---");
  console.log(flashcardsText);
  console.log("----------------------------");
}

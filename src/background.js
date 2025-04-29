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

    let flashcards;
    try {
      flashcards = await generateFlashcards({
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

    if (flashcards && flashcards.length > 0) {
      showFlashcards(flashcards, originalTabId);
    } else {
      if (originalTabId) {
        try {
          await browser.tabs.sendMessage(originalTabId, {
            type: "SHOW_INFO",
            message: "No flashcards were generated from the selected text.",
          });
        } catch (sendError) {
          console.warn(
            `Could not send 'no flashcards' message to tab ${originalTabId}: ${sendError.message}`
          );
        }
      }
    }
  }
});

async function generateFlashcards({ selectedText, apiKey, originalTabId }) {
  const { GoogleGenAI, Type } = await import("@google/genai");
  if (!apiKey) throw new Error("API Key is missing.");
  if (!selectedText) throw new Error("Selected text is missing.");
  const genAI = new GoogleGenAI({ apiKey });
  const prompt = `Generate flashcards based on the following content.\n\n<content>\n${selectedText}\n</content>`;
  const systemMessage = `You are a professional flash card generator. You help students study by generating flash cards based on their study content.\nAlways create an exhaustive list of flashcards that will prepare the user well for a test/exam. Make sure to include all important concepts and terms in the flashcards.`;

  const result = await genAI.models.generateContent({
    // model: "gemini-2.5-flash-preview-04-17",
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      systemInstruction: systemMessage,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING, description: "Flashcard term (front)", nullable: false },
            definition: {
              type: Type.STRING,
              description: "Flashcard definition (back)",
              nullable: false,
            },
          },
          required: ["term", "definition"],
          propertyOrdering: ["term", "definition"],
        },
      },
    },
  });
  let flashcards;
  try {
    flashcards = JSON.parse(result.text);
  } catch (e) {
    flashcards = [];
    console.error("Error parsing JSON response:", e);
    if (originalTabId) {
      try {
        await browser.tabs.sendMessage(originalTabId, {
          type: "SHOW_ERROR",
          message: "The AI failed to generate the flashcards properly. Please try again.",
        });
      } catch (sendError) {
        console.warn(
          `Could not send parse error message to tab ${originalTabId}: ${sendError.message}`
        );
      }
    }
    return [];
  }
  return flashcards;
}

async function showFlashcards(flashcards, originalTabId) {
  try {
    await browser.storage.local.set({ flashcards: flashcards });
    await browser.tabs.create({
      url: browser.runtime.getURL("dist/flashcards/flashcards.html"),
    });
  } catch (error) {
    console.error("Error storing flashcards or opening new tab:", error);
    if (originalTabId) {
      try {
        await browser.tabs.sendMessage(originalTabId, {
          type: "SHOW_ERROR",
          message: "Error displaying flashcards. Check background console.",
        });
      } catch (sendError) {
        console.warn(
          `Could not send storage/tab error message to tab ${originalTabId}: ${sendError.message}`
        );
      }
    }
  }
}

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

    let generatedData;
    try {
      generatedData = await generateFlashcards({
        selectedText: info.selectionText,
        apiKey: apiKey,
        originalTabId: originalTabId,
      });
    } catch (error) {
      console.error("Error generating flashcards in background:", error);
      await browser.tabs.sendMessage(originalTabId, {
        type: "SHOW_ERROR",
        message:
          "There was an error calling the Gemini API when generating flashcards. Full error:\n\n" +
          error.message.error.message,
      });
      return;
    }

    if (generatedData && generatedData.flashcards.length > 0) {
      await saveAndShowFlashcards(generatedData.setName, generatedData.flashcards, originalTabId);
    } else {
      await browser.tabs.sendMessage(originalTabId, {
        type: "SHOW_INFO",
        message: "No flashcards were generated from the selected text.",
      });
    }
  }
});

async function generateFlashcards({ selectedText, apiKey, originalTabId }) {
  const { GoogleGenAI, Type } = await import("@google/genai");
  if (!apiKey) throw new Error("API Key is missing.");
  if (!selectedText) throw new Error("Selected text is missing.");
  const genAI = new GoogleGenAI({ apiKey });
  const prompt = `Generate flashcards based on the following content.\n\n<content>\n${selectedText}\n</content>`;
  const systemMessage = `You are a professional flash card generator. You help students study by generating flash cards based on their study content.\nAlways create an exhaustive list of flashcards that will prepare the user well for a test/exam. Make sure to include all important concepts and terms in the flashcards. Also generate a concise, descriptive name for the flashcard set.`;

  const result = await genAI.models.generateContent({
    // model: "gemini-2.5-flash-preview-04-17",
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      systemInstruction: systemMessage,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          setName: {
            type: Type.STRING,
            description: "A concise name for the flashcard set.",
            nullable: false,
          },
          flashcards: {
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
        required: ["setName", "flashcards"],
        propertyOrdering: ["setName", "flashcards"],
      },
    },
  });
  let responseData;
  try {
    responseData = JSON.parse(result.text);
    if (!responseData || !responseData.flashcards || !responseData.setName) {
      throw new Error("Invalid response structure from AI.");
    }
  } catch (e) {
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
    return null;
  }
  return responseData;
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

    await browser.tabs.create({
      url: browser.runtime.getURL("dist/flashcards/flashcards.html"),
    });
  } catch (error) {
    console.error("Error storing flashcards or opening new tab:", error);
    if (originalTabId) {
      await browser.tabs.sendMessage(originalTabId, {
        type: "SHOW_ERROR",
        message: "Error saving or displaying flashcards. Check background console.",
      });
    }
  }
}

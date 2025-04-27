import { GoogleGenAI } from "@google/genai";

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(async (message) => {
  if (message.target !== "offscreen") {
    return false;
  }

  const originalTabId = message.data?.originalTabId;

  if (message.type === "generate-flashcards") {
    try {
      const apiKey = message.data.apiKey;
      const selectedText = message.data.selectedText;

      if (!apiKey) {
        throw new Error("API Key is missing.");
      }
      if (!selectedText) {
        throw new Error("Selected text is missing.");
      }
      if (!GoogleGenAI) {
        throw new Error("AI SDK is not available.");
      }

      const genAI = new GoogleGenAI({ apiKey: apiKey });
      const modelName = "gemini-2.5-flash-preview-04-17";

      const prompt = `Generate 3-5 flashcards (simple question and answer pairs) based on the following text. Format each flashcard as 'Q: [question]\nA: [answer]' and separate flashcards with a double newline:

<text>
${selectedText}
</text>
`;

      const result = await genAI.models.generateContent({
        model: modelName,
        contents: prompt,
      });

      const flashcardsText = result.text;

      // Send generated flashcards back to background script
      chrome.runtime.sendMessage({
        type: "flashcards-generated",
        target: "background",
        data: {
          flashcardsText: flashcardsText,
          originalTabId: originalTabId,
        },
      });
    } catch (error) {
      console.error("Error processing flashcard generation:", error);
      // Send error back to background script
      chrome.runtime.sendMessage({
        type: "generation-error",
        target: "background",
        error: "There was an error generating flashcards.",
        data: {
          originalTabId: originalTabId,
        },
      });
    }
    return true; // Indicate async response
  }
  return false; // Message type not handled
});

// LLM service for generating flashcards using GoogleGenAI
import { parse as bestEffortParse } from "best-effort-json-parser";

/**
 * Stream flashcards generation from LLM (GoogleGenAI Gemini).
 * @param {string} text Text to generate flashcards from.
 * @param {string} apiKey Gemini API key.
 * @returns {AsyncGenerator<{setName: string, flashcards: Array<{term: string, definition: string}>}, void, unknown>}
 */
export async function* streamFlashcardsFromLLM({ text, apiKey }) {
  const { GoogleGenAI, Type } = await import("@google/genai");
  if (!apiKey) throw new Error("API Key is missing.");
  if (!text) throw new Error("Selected text is missing.");

  const genAI = new GoogleGenAI({ apiKey });
  const prompt = `Generate flashcards based on the following content. Keep the front/back of each flashcard brief, just including important information.\n\n<content>\n${text}\n</content>`;
  const systemMessage = `You are a professional flash card generator. You help students study by generating flash cards based on their study content.\nAlways create an exhaustive list of flashcards that will prepare the user well for a test/exam. Make sure to include all important concepts and terms in the flashcards. Also generate a concise, descriptive name for the flashcard set.`;

  const response = await genAI.models.generateContentStream({
    model: "gemini-2.0-flash-lite",
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
                term: {
                  type: Type.STRING,
                  description: "Flashcard term (front)",
                  nullable: false,
                },
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

  let buffer = "";
  for await (const chunk of response) {
    const text = chunk.text || "";
    buffer += text;
    let parsed = null;
    try {
      parsed = bestEffortParse(buffer);
    } catch (e) {
      continue;
    }

    yield parsed;
  }
}

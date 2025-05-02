// LLM service for generating flashcards using GoogleGenAI
import { parse as bestEffortParse } from "best-effort-json-parser";

/**
 * Stream flashcards generation from LLM (GoogleGenAI Gemini).
 * @param {string} text Text to generate flashcards from.
 * @param {string} apiKey Gemini API key.
 * @param {string} [model] Gemini model name.
 * @returns {AsyncGenerator<{setName: string, flashcards: Array<{term: string, definition: string}>}, void, unknown>}
 */
export async function* streamFlashcardsFromLLM(
  text,
  apiKey,
  model = "gemini-2.5-flash-preview-04-17"
) {
  const { GoogleGenAI, Type } = await import("@google/genai");
  if (!apiKey) throw new Error("API Key is missing.");
  if (!text) throw new Error("Selected text is missing.");

  const genAI = new GoogleGenAI({ apiKey });
  const systemMessage = `
You are a professional flash card generator that transforms a passage of text into concise, high-quality flash cards for students to study from.

Guidelines:
- Always create an exhaustive list of flashcards that will prepare the user well for a test/exam.
- Exclude trivial details or irrelevant information.
- Make sure to include all important concepts and terms in the flashcards.
- Keep the front and back of each flashcard brief, just including important information.`;

  const prompt = `
Generate flashcards based on the following content.
Focus on the most important concepts, terms, or facts a student should remember.

<content>
${text}
</content>`;

  const response = await genAI.models.generateContentStream({
    model: model,
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
                  description:
                    "Flashcard term (front). This is a concept, keyword, question, or phrase that students should recall.",
                  nullable: false,
                },
                definition: {
                  type: Type.STRING,
                  description:
                    "Flashcard definition (back). This should be a clear and concise, self-contained explanation or answer.",
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

import browser from "webextension-polyfill";

/**
 * Creates a new card entry element from a template.
 * @param {HTMLTemplateElement} templateEl
 * @param {string} term
 * @param {string} definition
 * @returns {HTMLElement}
 */
export function createCardEntry(templateEl, term = "", definition = "") {
  const node = templateEl.content.firstElementChild.cloneNode(true);
  const termInput = node.querySelector(".card-term");
  const defInput = node.querySelector(".card-definition");
  termInput.value = term;
  defInput.value = definition;
  node.querySelector(".delete-card-btn").addEventListener("click", () => {
    if (confirm("Are you sure you want to delete this flashcard?")) {
      node.remove();
    }
  });
  return node;
}

/**
 * Displays a message in the given element.
 * @param {HTMLElement} messageEl
 * @param {string} msg
 * @param {string} type  // e.g., 'error' or 'success'
 */
export function showMessage(messageEl, msg, type) {
  messageEl.textContent = msg;
  messageEl.className = type;
}

/**
 * Collects flashcards (term + definition) from a container.
 * @param {HTMLElement} containerEl
 * @returns {{term: string, definition: string}[]} Array of flashcard objects.
 */
export function collectFlashcards(containerEl) {
  const entries = Array.from(containerEl.querySelectorAll(".card-entry"));
  return entries.map((entry) => {
    const term = entry.querySelector(".card-term").value.trim();
    const definition = entry.querySelector(".card-definition").value.trim();
    return { term, definition };
  });
}

/**
 * Validates the set name and flashcards, throws an Error if invalid.
 * @param {string} setName
 * @param {{term: string, definition: string}[]} flashcards
 */
export function validateFlashcards(setName, flashcards) {
  if (!setName) {
    throw new Error("Please enter a set name.");
  }
  if (!flashcards.length) {
    throw new Error("Please add at least one flashcard.");
  }
  flashcards.forEach((card, i) => {
    if (!card.term || !card.definition) {
      throw new Error(`Card ${i + 1}: both term and definition are required.`);
    }
  });
}

/**
 * Gets a non-colliding name for a new flashcard set.
 * @param {Object} allSets
 * @param {string} baseName
 */
export function getNonCollidingSetName(allSets, baseName) {
  let finalName = baseName;
  let counter = 1;
  while (allSets.hasOwnProperty(finalName)) {
    finalName = `${baseName} (${counter})`;
    counter++;
  }
  return finalName;
}

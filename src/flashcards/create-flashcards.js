import browser from "webextension-polyfill";
import {
  createCardEntry,
  showMessage,
  collectFlashcards,
  validateFlashcards,
  getNonCollidingSetName,
} from "./flashcard-form.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-form");
  const setNameInput = document.getElementById("set-name");
  const cardsContainer = document.getElementById("cards-container");
  const addCardBtn = document.getElementById("add-card-btn");
  const messageDiv = document.getElementById("message");
  const cardEntryTemplate = document.getElementById("card-entry-template");

  // Add initial card entry
  cardsContainer.appendChild(createCardEntry(cardEntryTemplate));

  // Add new entry on button click
  addCardBtn.addEventListener("click", () => {
    cardsContainer.appendChild(createCardEntry(cardEntryTemplate));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageDiv.textContent = "";
    messageDiv.className = "";

    const setName = setNameInput.value.trim();
    let flashcards;
    try {
      flashcards = collectFlashcards(cardsContainer);
      validateFlashcards(setName, flashcards);
    } catch (err) {
      showMessage(messageDiv, err.message, "error");
      return;
    }

    try {
      const stored = await browser.storage.local.get("flashcardSets");
      const allSets = stored.flashcardSets || {};
      const finalName = getNonCollidingSetName(allSets, setName);
      allSets[finalName] = flashcards;
      await browser.storage.local.set({ flashcardSets: allSets });

      showMessage(messageDiv, `Flashcard set "${finalName}" saved successfully.`, "success");
      // Reset form and entries
      setNameInput.value = "";
      cardsContainer.innerHTML = "";
      cardsContainer.appendChild(createCardEntry(cardEntryTemplate));
      form.reset();
    } catch (err) {
      console.error("Error saving flashcard set:", err);
      showMessage(messageDiv, "Error saving flashcard set. Please try again.", "error");
    }
  });
});

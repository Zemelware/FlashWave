import browser from "webextension-polyfill";
import {
  createCardEntry,
  showMessage,
  collectFlashcards,
  validateFlashcards,
  getNonCollidingSetName,
} from "./flashcard-form.js";

document.addEventListener("DOMContentLoaded", () => {
  const setSelect = document.getElementById("set-select");
  const deleteSetBtn = document.getElementById("delete-set-button");
  const editForm = document.getElementById("edit-form");
  const setNameInput = document.getElementById("set-name");
  const cardsContainer = document.getElementById("cards-container");
  const addCardBtn = document.getElementById("add-card-btn");
  const messageDiv = document.getElementById("message");
  const cardEntryTemplate = document.getElementById("card-entry-template");
  let originalName = null;

  // Populate set dropdown
  async function loadSets() {
    const stored = await browser.storage.local.get("flashcardSets");
    const allSets = stored.flashcardSets || {};
    // Reset options
    while (setSelect.options.length > 1) {
      setSelect.remove(1);
    }
    Object.keys(allSets).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      setSelect.appendChild(opt);
    });
    deleteSetBtn.disabled = true;
  }

  async function loadSelectedSet() {
    messageDiv.textContent = "";
    const setName = setSelect.value;
    if (!setName) return;
    const stored = await browser.storage.local.get("flashcardSets");
    const allSets = stored.flashcardSets || {};
    const cards = allSets[setName] || [];
    originalName = setName;
    // Populate form
    setNameInput.value = setName;
    cardsContainer.innerHTML = "";
    cards.forEach(({ term, definition }) => {
      cardsContainer.appendChild(createCardEntry(cardEntryTemplate, term, definition));
    });
    editForm.style.display = "";
  }

  // Handle set selection change and auto-load selected set
  setSelect.addEventListener("change", async () => {
    const selected = setSelect.value;
    deleteSetBtn.disabled = !selected;
    // Clear message and hide form before loading
    messageDiv.textContent = "";
    editForm.style.display = "none";
    if (selected) {
      await loadSelectedSet();
    }
  });

  deleteSetBtn.addEventListener("click", async () => {
    const setName = setSelect.value;
    if (!setName) return;
    if (confirm(`Are you sure you want to delete the flashcard set "${setName}"?`)) {
      const stored = await browser.storage.local.get("flashcardSets");
      const allSets = stored.flashcardSets || {};
      delete allSets[setName];
      await browser.storage.local.set({ flashcardSets: allSets });
      showMessage(messageDiv, `Flashcard set "${setName}" deleted.`, "success");
      // Refresh dropdown and hide form
      await loadSets();
      editForm.style.display = "none";
    }
  });

  // Add new card entry
  addCardBtn.addEventListener("click", () => {
    cardsContainer.appendChild(createCardEntry(cardEntryTemplate));
  });

  // Handle form submission for updating set
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageDiv.textContent = "";
    const newName = setNameInput.value.trim();
    let flashcards;
    try {
      flashcards = collectFlashcards(cardsContainer);
      validateFlashcards(newName, flashcards);
    } catch (err) {
      showMessage(messageDiv, err.message, "error");
      return;
    }

    try {
      const stored = await browser.storage.local.get("flashcardSets");
      const allSets = stored.flashcardSets || {};
      let finalName = newName;
      if (newName !== originalName) {
        finalName = getNonCollidingSetName(allSets, newName);
        // Remove old key
        delete allSets[originalName];
      }
      allSets[finalName] = flashcards;
      await browser.storage.local.set({ flashcardSets: allSets });
      showMessage(messageDiv, `Flashcard set "${finalName}" updated successfully.`, "success");
      originalName = finalName;
      // Refresh dropdown and keep current selection
      await loadSets();
      setSelect.value = finalName;
    } catch (err) {
      console.error("Error updating flashcard set:", err);
      showMessage(messageDiv, "Error updating flashcard set. Please try again.", "error");
    }
  });

  // Initial load
  loadSets();
});

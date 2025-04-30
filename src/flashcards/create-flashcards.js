import browser from "webextension-polyfill";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-form");
  const setNameInput = document.getElementById("set-name");
  const cardsContainer = document.getElementById("cards-container");
  const addCardBtn = document.getElementById("add-card-btn");
  const messageDiv = document.getElementById("message");
  const cardEntryTemplate = document.getElementById("card-entry-template");

  // Function to create a card entry row using the template
  function createCardEntry(term = "", definition = "") {
    const node = cardEntryTemplate.content.firstElementChild.cloneNode(true);
    const termInput = node.querySelector(".card-term");
    const defInput = node.querySelector(".card-definition");
    termInput.value = term;
    defInput.value = definition;
    node.querySelector(".delete-card-btn").addEventListener("click", () => {
      node.remove();
    });
    return node;
  }

  // Add initial card entry
  cardsContainer.appendChild(createCardEntry());

  // Add new entry on button click
  addCardBtn.addEventListener("click", () => {
    cardsContainer.appendChild(createCardEntry());
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageDiv.textContent = "";
    messageDiv.className = "";

    const setName = setNameInput.value.trim();
    const entries = Array.from(cardsContainer.querySelectorAll(".card-entry"));
    const flashcards = [];

    if (!setName) {
      showMessage("Please enter a set name.", "error");
      return;
    }
    if (entries.length === 0) {
      showMessage("Please add at least one flashcard.", "error");
      return;
    }

    // Gather terms and definitions
    for (let i = 0; i < entries.length; i++) {
      const termInput = entries[i].querySelector(".card-term");
      const defInput = entries[i].querySelector(".card-definition");
      const term = termInput.value.trim();
      const definition = defInput.value.trim();
      if (!term || !definition) {
        showMessage(`Card ${i + 1}: both term and definition are required.`, "error");
        return;
      }
      flashcards.push({ term, definition });
    }

    try {
      const stored = await browser.storage.local.get("flashcardSets");
      const allSets = stored.flashcardSets || {};
      let finalName = setName;
      let counter = 1;
      while (allSets.hasOwnProperty(finalName)) {
        finalName = `${setName} (${counter})`;
        counter++;
      }
      allSets[finalName] = flashcards;
      await browser.storage.local.set({ flashcardSets: allSets });
      showMessage(`Flashcard set "${finalName}" saved successfully.`, "success");
      // Reset form and entries
      setNameInput.value = "";
      cardsContainer.innerHTML = "";
      cardsContainer.appendChild(createCardEntry());
      form.reset();
      // Notify any open flashcards page to reload
      browser.runtime.sendMessage({ type: "FLASHCARDS_UPDATED" });
    } catch (err) {
      console.error("Error saving flashcard set:", err);
      showMessage("Error saving flashcard set. Please try again.", "error");
    }
  });

  function showMessage(msg, type) {
    messageDiv.textContent = msg;
    messageDiv.className = type;
  }
});

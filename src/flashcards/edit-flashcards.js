import browser from "webextension-polyfill";

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

  function showMessage(msg, type) {
    messageDiv.textContent = msg;
    messageDiv.className = type;
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
      cardsContainer.appendChild(createCardEntry(term, definition));
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
      showMessage(`Flashcard set "${setName}" deleted.`, "success");
      // Refresh dropdown and hide form
      await loadSets();
      editForm.style.display = "none";
      browser.runtime.sendMessage({ type: "FLASHCARDS_UPDATED" });
    }
  });

  // Add new card entry
  addCardBtn.addEventListener("click", () => {
    cardsContainer.appendChild(createCardEntry());
  });

  // Handle form submission for updating set
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    messageDiv.textContent = "";
    const newName = setNameInput.value.trim();
    const entries = Array.from(cardsContainer.querySelectorAll(" .card-entry"));
    const flashcards = [];
    if (!newName) {
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
      let finalName = newName;
      if (newName !== originalName) {
        let counter = 1;
        while (allSets.hasOwnProperty(finalName)) {
          finalName = `${newName} (${counter})`;
          counter++;
        }
        // Remove old key
        delete allSets[originalName];
      }
      allSets[finalName] = flashcards;
      await browser.storage.local.set({ flashcardSets: allSets });
      showMessage(`Flashcard set "${finalName}" updated successfully.`, "success");
      originalName = finalName;
      // Refresh dropdown and keep current selection
      await loadSets();
      setSelect.value = finalName;
      browser.runtime.sendMessage({ type: "FLASHCARDS_UPDATED" });
    } catch (err) {
      console.error("Error updating flashcard set:", err);
      showMessage("Error updating flashcard set. Please try again.", "error");
    }
  });

  // Initial load
  loadSets();
});

import browser from "webextension-polyfill";

document.addEventListener("DOMContentLoaded", () => {
  const setSelect = document.getElementById("set-select");
  const shuffleToggle = document.getElementById("shuffle-toggle");
  const container = document.getElementById("flashcard-container");
  const navControls = document.getElementById("nav-controls");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const counter = document.getElementById("counter");
  const instructionsDiv = document.querySelector(".instructions");

  let allSets = {};
  let currentFlashcards = [];
  let currentIndex = 0;
  let currentCardElement = null;
  let isShuffled = false;
  let originalOrder = [];

  function showFlashcard(index) {
    if (currentCardElement) {
      currentCardElement.remove(); // Remove the DOM element of the previous card
    }
    if (currentFlashcards && currentFlashcards[index]) {
      currentCardElement = createFlashcardElement(currentFlashcards[index]);
      // Clear previous content (like 'Select a set' message) before adding card
      const existingMessages = container.querySelectorAll(".no-flashcards, .instructions");
      existingMessages.forEach((msg) => msg.remove());
      container.appendChild(currentCardElement);
      updateNav();
    } else {
      console.error(
        "Attempted to show flashcard at invalid index or with no flashcards loaded:",
        index
      );
      clearFlashcardDisplay(); // Clear display if something went wrong
    }
  }

  function updateNav() {
    if (currentFlashcards.length > 0) {
      counter.textContent = `${currentIndex + 1} / ${currentFlashcards.length}`;
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === currentFlashcards.length - 1;
      navControls.style.display = "flex";
    } else if (navControls) {
      navControls.style.display = "none"; // Hide nav if no cards
    }
  }

  function createFlashcardElement(cardData) {
    const template = document.getElementById("flashcard-template");
    const card = template.content.firstElementChild.cloneNode(true);

    card.querySelector(".flashcard-front .flashcard-content").textContent = cardData.term;
    card.querySelector(".flashcard-back .flashcard-content").textContent = cardData.definition;

    card.addEventListener("click", () => {
      card.classList.toggle("is-flipped");
    });

    return card;
  }

  function clearFlashcardDisplay() {
    if (currentCardElement) {
      currentCardElement.remove();
      currentCardElement = null;
    }
    // Remove any existing cards or messages
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.style.display = "block";
    instructionsDiv.style.display = "none";
    navControls.style.display = "none";
    currentIndex = 0;
    currentFlashcards = [];
  }

  function shuffleArray(arr) {
    // Fisher-Yates shuffle
    const a = arr.slice(); // Create a copy to avoid modifying the original array
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function resetShuffle() {
    shuffleToggle.checked = false;
    isShuffled = false;
    originalOrder = [];
  }

  // --- Event Listeners ---
  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      showFlashcard(currentIndex);
    }
  });

  nextBtn.addEventListener("click", () => {
    if (currentIndex < currentFlashcards.length - 1) {
      currentIndex++;
      showFlashcard(currentIndex);
    }
  });

  setSelect.addEventListener("change", () => {
    const selectedSetName = setSelect.value;
    if (selectedSetName && allSets[selectedSetName]) {
      originalOrder = allSets[selectedSetName].slice();
      if (isShuffled) {
        currentFlashcards = shuffleArray(originalOrder);
      } else {
        currentFlashcards = originalOrder.slice();
      }
      currentIndex = 0;
      container.style.display = "block";
      instructionsDiv.style.display = "block";
      showFlashcard(currentIndex);
    } else {
      clearFlashcardDisplay();
    }
  });

  shuffleToggle.addEventListener("change", () => {
    isShuffled = shuffleToggle.checked;
    if (originalOrder.length > 0) {
      if (isShuffled) {
        currentFlashcards = shuffleArray(originalOrder);
      } else {
        currentFlashcards = originalOrder.slice();
      }
      currentIndex = 0;
      showFlashcard(currentIndex);
    }
  });

  // --- Load Sets on Initialization ---
  async function loadFlashcardSets() {
    try {
      const result = await browser.storage.local.get("flashcardSets");
      allSets = result.flashcardSets || {};

      // Clear existing options except the default
      while (setSelect.options.length > 1) {
        setSelect.remove(1);
      }

      const setNames = Object.keys(allSets);
      if (setNames.length > 0) {
        setNames.sort().forEach((setName) => {
          // Sort names alphabetically
          const option = document.createElement("option");
          option.value = setName;
          option.textContent = setName;
          setSelect.appendChild(option);
        });
        clearFlashcardDisplay();
        resetShuffle();
      } else {
        // No sets found
        if (container) {
          container.innerHTML =
            '<p class="no-flashcards">No flashcards found. Create some by selecting text on a webpage and using the right-click menu!</p>';
          container.style.display = "block";
        }
        instructionsDiv.style.display = "none";
        navControls.style.display = "none";
        resetShuffle();
      }
    } catch (error) {
      console.error("Error loading flashcard sets:", error);
      if (container) {
        container.innerHTML =
          '<p class="no-flashcards" style="color: red;">Error loading flashcard sets.</p>';
        container.style.display = "block";
      }
      instructionsDiv.style.display = "none";
      navControls.style.display = "none";
      resetShuffle();
    }
  }

  loadFlashcardSets();

  // Listen for message from background to reload flashcard sets
  browser.runtime.onMessage.addListener((message) => {
    if (message && message.type === "FLASHCARDS_UPDATED") {
      loadFlashcardSets();
    }
  });
});

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
  const setControlsDiv = document.querySelector(".set-controls");
  const statusMessageDiv = document.getElementById("status-message");

  let allSets = {};
  let currentFlashcards = [];
  let currentIndex = 0;
  let currentCardElement = null;
  let isShuffled = false;
  let originalOrder = []; // Original order of flashcards before shuffling

  let isStreaming = false;
  let parsedFlashcardsDuringStream = [];
  let streamSetName = null;
  let port = null;

  function handlePortMessage(message) {
    switch (message.type) {
      case "STREAM_START":
        clearFlashcardDisplay();
        isStreaming = true;
        parsedFlashcardsDuringStream = [];
        streamSetName = null;
        statusMessageDiv.textContent = "Generating flashcards...";
        statusMessageDiv.style.display = "block";
        container.style.display = "block";
        instructionsDiv.style.display = "none";
        navControls.style.display = "none";
        setControlsDiv.style.display = "none";
        break;
      
      case "STREAM_SETNAME":
        streamSetName = message.setName;
        statusMessageDiv.innerHTML = `Generating flashcards for ${streamSetName}<br><strong>Don't refresh or close this page!</strong>`;
        statusMessageDiv.style.display = "block";
        break;

      case "STREAM_CARD":
        if (isStreaming && message.card) {
          parsedFlashcardsDuringStream.push(message.card);
          currentIndex = parsedFlashcardsDuringStream.length - 1;
          showFlashcard(currentIndex, true);
        }
        break;

      case "STREAM_COMPLETE":
        if (isStreaming) {
          isStreaming = false;
          // Hide the status message when generation is complete
          statusMessageDiv.textContent = "";
          statusMessageDiv.style.display = "none";
          const finalSetName = message.setName || streamSetName || "Untitled Set";

          loadFlashcardSets(finalSetName)
            .then(() => {
              if (isShuffled) {
                currentFlashcards = shuffleArray(originalOrder);
              }

              currentIndex = 0;
              showFlashcard(currentIndex, false);
              updateNav(false);
              setControlsDiv.style.display = "block";
            })
            .catch((error) => {
              console.error("Error during post-stream loadFlashcardSets:", error);
              clearFlashcardDisplay();
              container.innerHTML = `<p class="error-msg" style="color: red;">Error loading the new set after generation.</p>`;
              setControlsDiv.style.display = "block";
            });
        }
        break;

      case "STREAM_ERROR":
        isStreaming = false;
        clearFlashcardDisplay();
        container.innerHTML = `<p class="error-msg" style="color: red;">${message.message}</p>`;
        setControlsDiv.style.display = "block";
        break;

      default:
        console.warn("Unknown message type received on port:", message.type);
        break;
    }
  }

  function handlePortDisconnect() {
    console.error("Streaming port disconnected.");
    if (isStreaming) {
      isStreaming = false;
      clearFlashcardDisplay();
      container.innerHTML = `<p class="error-msg" style="color: red;">Connection lost during generation. Please reload and try again.</p>`;
      setControlsDiv.style.display = "block";
    }
    port = null;
  }

  function setupPortConnection() {
    if (port) {
      try {
        console.log("Disconnecting existing port before creating new one.");
        port.disconnect();
      } catch (e) {
        console.warn("Error disconnecting old port (might be already disconnected):", e.message);
      }
      port = null;
    }

    try {
      port = browser.runtime.connect({ name: "flashcards-stream" });
      console.log("Establishing new streaming port connection.");
      port.onMessage.addListener(handlePortMessage);
      port.onDisconnect.addListener(handlePortDisconnect);
    } catch (error) {
      console.error("Failed to establish port connection:", error);
      statusMessageDiv.textContent =
        "Error connecting to background service. Please reload and try again.";
      statusMessageDiv.style.color = "red";
      statusMessageDiv.style.display = "block";
    }
  }

  function showFlashcard(index, useStreamingData = false) {
    // If streaming, always use parsedFlashcardsDuringStream, otherwise use currentFlashcards
    const cardsToShow =
      isStreaming || useStreamingData ? parsedFlashcardsDuringStream : currentFlashcards;

    if (currentCardElement) {
      currentCardElement.remove();
    }
    if (cardsToShow && cardsToShow[index]) {
      currentCardElement = createFlashcardElement(cardsToShow[index]);
      // Clear previous content before adding card
      const existingMessages = container.querySelectorAll(
        ".error-msg, .instructions"
      );
      existingMessages.forEach((msg) => msg.remove());
      container.appendChild(currentCardElement);
      updateNav(useStreamingData);
      setControlsDiv.style.display = isStreaming ? "none" : "block";
      instructionsDiv.style.display = "block";
    } else {
      console.error(
        "Attempted to show flashcard at invalid index or with no flashcards loaded:",
        index,
        "using streaming data:",
        useStreamingData
      );
      clearFlashcardDisplay();
    }
  }

  function updateNav(useStreamingData = false) {
    // If streaming, always use parsedFlashcardsDuringStream, otherwise use currentFlashcards
    const cards =
      isStreaming || useStreamingData ? parsedFlashcardsDuringStream : currentFlashcards;
    const total = cards.length;

    if (total > 0) {
      if (isStreaming) {
        counter.textContent = `Generating card ${currentIndex + 1}`;
        prevBtn.disabled = true;
        nextBtn.disabled = true;
      } else {
        counter.textContent = `${currentIndex + 1} / ${total}`;
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === total - 1;
      }
      navControls.style.display = "flex";
    } else {
      navControls.style.display = "none";
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

  function clearFlashcardDisplay(showDefaultMessage = false) {
    if (currentCardElement) {
      currentCardElement.remove();
      currentCardElement = null;
    }
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    statusMessageDiv.textContent = "";
    statusMessageDiv.style.display = "none";
    container.style.display = "block";
    instructionsDiv.style.display = "none";
    navControls.style.display = "none";
    setControlsDiv.style.display = "block";
    currentIndex = 0;
    currentFlashcards = [];
    isStreaming = false;
    parsedFlashcardsDuringStream = [];
    streamSetName = null;

    if (showDefaultMessage && Object.keys(allSets).length === 0) {
      container.innerHTML =
        '<p class="error-msg">No flashcards found. Create some by selecting text on a webpage and using the right-click menu!</p>';
    } else if (showDefaultMessage) {
      container.innerHTML = '<p class="instructions">Select a set to start viewing flashcards.</p>';
      instructionsDiv.style.display = "none";
    }
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function resetShuffle() {
    shuffleToggle.checked = false;
    isShuffled = false;
  }

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
      clearFlashcardDisplay(true);
    }
  });

  shuffleToggle.addEventListener("change", () => {
    isShuffled = shuffleToggle.checked;
    // Only allow shuffle if a set is selected and originalOrder is not empty
    if (!setSelect.value || originalOrder.length === 0) {
      // No set selected, do nothing (don't show any cards)
      return;
    }
    if (isShuffled) {
      currentFlashcards = shuffleArray(originalOrder);
    } else {
      currentFlashcards = originalOrder.slice();
    }
    currentIndex = 0;
    showFlashcard(currentIndex);
  });

  // --- Load Sets on Initialization ---
  async function loadFlashcardSets(selectSetName = null) {
    try {
      const result = await browser.storage.local.get("flashcardSets");
      allSets = result.flashcardSets || {};

      const currentSelection = setSelect.value;

      while (setSelect.options.length > 1) {
        setSelect.remove(1);
      }

      const setNames = Object.keys(allSets);
      let newlyAddedSetExists = false;
      if (setNames.length > 0) {
        setNames.sort().forEach((setName) => {
          const option = document.createElement("option");
          option.value = setName;
          option.textContent = setName;
          setSelect.appendChild(option);
          if (setName === selectSetName) {
            newlyAddedSetExists = true;
          }
        });

        if (selectSetName && newlyAddedSetExists) {
          setSelect.value = selectSetName;
        } else if (allSets[currentSelection]) {
          setSelect.value = currentSelection;
        } else {
          setSelect.value = "";
        }

        if (setSelect.value) {
          setSelect.dispatchEvent(new Event("change"));
        } else {
          clearFlashcardDisplay(true);
        }
        resetShuffle();
      } else {
        clearFlashcardDisplay(true);
        resetShuffle();
      }
    } catch (error) {
      console.error("Error loading flashcard sets:", error);
      if (container) {
        container.innerHTML =
          '<p class="error-msg" style="color: red;">Error loading flashcard sets.</p>';
        container.style.display = "block";
      }
      instructionsDiv.style.display = "none";
      navControls.style.display = "none";
      resetShuffle();
    }
  }

  setupPortConnection();
  loadFlashcardSets();

  browser.runtime.onMessage.addListener((message) => {
    if (message && message.type === "REQUEST_RECONNECT") {
      setupPortConnection(); // Re-establish the connection
    }
    if (message && message.type === "FLASHCARDS_UPDATED" && !isStreaming) {
      loadFlashcardSets(message.newSetName);
    }
  });
});

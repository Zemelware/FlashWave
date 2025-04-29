document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("flashcard-container");
  const loadingMessage = document.getElementById("loading-message");
  const navControls = document.getElementById("nav-controls");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const counter = document.getElementById("counter");

  let flashcards = [];
  let currentIndex = 0;
  let cardElement = null;

  function showFlashcard(index) {
    if (cardElement) {
      cardElement.remove(); // Remove the DOM element of the previous card
    }
    cardElement = createFlashcardElement(flashcards[index]);
    container.appendChild(cardElement);
    updateNav();
  }

  function updateNav() {
    counter.textContent = `${currentIndex + 1} / ${flashcards.length}`;
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === flashcards.length - 1;
  }

  prevBtn.addEventListener("click", () => {
    if (currentIndex > 0) {
      currentIndex--;
      showFlashcard(currentIndex);
    }
  });
  nextBtn.addEventListener("click", () => {
    if (currentIndex < flashcards.length - 1) {
      currentIndex++;
      showFlashcard(currentIndex);
    }
  });

  browser.storage.local
    .get("flashcards")
    .then((result) => {
      flashcards = result.flashcards || [];
      if (loadingMessage) loadingMessage.remove();
      if (flashcards.length > 0) {
        navControls.style.display = "flex";
        showFlashcard(currentIndex);
        browser.storage.local.remove("flashcards");
      } else {
        navControls.style.display = "none";
        const noCardsMessage = document.createElement("p");
        noCardsMessage.textContent = "No flashcards were generated or found.";
        noCardsMessage.className = "no-flashcards";
        container.appendChild(noCardsMessage);
      }
    })
    .catch((error) => {
      if (loadingMessage) loadingMessage.textContent = "Error loading flashcards.";
      navControls.style.display = "none";
      const errorMessage = document.createElement("p");
      errorMessage.textContent = "Error loading flashcards.";
      errorMessage.className = "no-flashcards";
      errorMessage.style.color = "red";
      container.appendChild(errorMessage);
    });
});

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

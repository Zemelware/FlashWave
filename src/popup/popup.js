import browser from "webextension-polyfill";

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveButton = document.getElementById("save-button");
  const saveStatus = document.getElementById("save-status");
  const openFlashcardsButton = document.getElementById("open-flashcards-btn");
  const modelSelect = document.getElementById("modelSelect");
  const customModelInput = document.getElementById("customModelInput");

  // Load the saved API key and model when the popup opens
  browser.storage.sync.get(["apiKey", "llmModel"]).then((result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    if (result.llmModel) {
      if (
        modelSelect.querySelector(`option[value='${result.llmModel}']`)
      ) {
        modelSelect.value = result.llmModel;
        customModelInput.style.display = "none";
      } else {
        modelSelect.value = "custom";
        customModelInput.style.display = "block";
        customModelInput.value = result.llmModel;
      }
    }
  });

  // Show/hide custom model input
  modelSelect.addEventListener("change", () => {
    if (modelSelect.value === "custom") {
      customModelInput.style.display = "block";
    } else {
      customModelInput.style.display = "none";
    }
  });

  // Save the API key and model when the button is clicked
  saveButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    let llmModel = modelSelect.value;
    if (llmModel === "custom") {
      llmModel = customModelInput.value.trim();
    }
    browser.storage.sync.set({ apiKey, llmModel }).then(() => {
      if (saveStatus) {
        saveStatus.textContent = "Settings saved successfully!";
        setTimeout(() => {
          saveStatus.textContent = "";
        }, 5000);
      }
    });
  });

  openFlashcardsButton.addEventListener("click", async () => {
    const flashcardsUrl = browser.runtime.getURL("flashcards/flashcards.html");
    const existingTabs = await browser.tabs.query({ url: flashcardsUrl });
    if (existingTabs.length > 0) {
      await browser.tabs.update(existingTabs[0].id, { active: true });
      if (existingTabs[0].windowId) {
        await browser.windows.update(existingTabs[0].windowId, { focused: true });
      }
    } else {
      await browser.tabs.create({ url: flashcardsUrl });
    }
  });
});

import browser from "webextension-polyfill";

document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveButton = document.getElementById("saveButton");

  // Load the saved API key when the popup opens
  browser.storage.sync.get(["apiKey"]).then((result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Save the API key when the button is clicked
  saveButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    browser.storage.sync.set({ apiKey: apiKey }).then(() => {
      console.log("API Key saved.");
    });
  });
});

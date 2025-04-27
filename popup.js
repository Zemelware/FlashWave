document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveButton = document.getElementById("saveButton");

  // Load the saved API key when the popup opens
  chrome.storage.sync.get(["apiKey"], (result) => {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  // Save the API key when the button is clicked
  saveButton.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    chrome.storage.sync.set({ apiKey: apiKey }, () => {
      console.log("API Key saved.");
    });
  });
});

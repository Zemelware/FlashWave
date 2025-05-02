import browser from "webextension-polyfill";
import { getNonCollidingSetName } from "./flashcard-form";

async function loadSets() {
  const { flashcardSets = {} } = await browser.storage.local.get("flashcardSets");
  const exportList = document.getElementById("export-list");
  exportList.innerHTML = "";
  Object.keys(flashcardSets).forEach((name) => {
    const label = document.createElement("label");
    label.style.display = "block";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = name;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + name));
    exportList.appendChild(label);
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  browser.downloads.download({ url, filename });
}

// Export selected sets as Anki-format text files
async function onExportClick() {
  const messageDiv = document.getElementById("message");
  messageDiv.textContent = "";
  const checks = document.querySelectorAll("#export-list input:checked");
  if (checks.length === 0) {
    messageDiv.textContent = "No sets selected for export.";
    return;
  }
  const { flashcardSets = {} } = await browser.storage.local.get("flashcardSets");
  let currentDate = new Date();
  currentDate = currentDate.toISOString().split("T")[0];
  const exportFolder = `FlashWave Exports - ${currentDate}`;
  checks.forEach((cb) => {
    const name = cb.value;
    const cards = flashcardSets[name] || [];
    const lines = cards.map((c) => `${c.term};${c.definition}`);
    const content = lines.join("\n");
    downloadText(`${exportFolder}/${name}.txt`, content);
  });
  messageDiv.textContent = `Exported ${checks.length} set(s) to '${exportFolder}' folder.`;
}

// Import Anki-format text files as new sets
async function onImportClick() {
  const messageDiv = document.getElementById("message");
  const importInput = document.getElementById("import-input");
  messageDiv.textContent = "";
  const files = importInput.files;
  if (!files || files.length === 0) {
    messageDiv.textContent = "No files selected for import.";
    return;
  }
  const { flashcardSets = {} } = await browser.storage.local.get("flashcardSets");
  for (const file of files) {
    const text = await file.text();
    const lines = text.split(/\r?\n/);
    // detect separator
    const first = lines.find((L) => L && !L.startsWith("#"));
    let sep = ";";
    if (first) {
      if (first.includes("\t")) sep = "\t";
      else if (first.includes(";")) sep = ";";
      else if (first.includes(",")) sep = ",";
    }
    const cards = [];
    lines.forEach((line) => {
      if (!line || line.startsWith("#")) return;
      const fields = line.split(sep);
      if (fields.length >= 2) {
        cards.push({ term: fields[0], definition: fields[1] });
      }
    });
    // Remove file extension
    let baseName = file.name.replace(/\.[^/.]+$/, "");
    // Remove trailing space and number in parentheses
    baseName = baseName.replace(/\s*\(\d+\)$/, "");
    const setName = getNonCollidingSetName(flashcardSets, baseName);
    flashcardSets[setName] = cards;
  }
  await browser.storage.local.set({ flashcardSets });
  await loadSets();
  messageDiv.textContent = `Imported ${files.length} file(s).`;
}

document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  loadSets();
  exportBtn.addEventListener("click", onExportClick);
  importBtn.addEventListener("click", onImportClick);
});

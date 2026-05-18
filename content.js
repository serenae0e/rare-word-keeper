const RWK_STORAGE_KEY = "rareWordKeeper.words";
const WORD_PATTERN = /^[A-Za-z][A-Za-z'-]{1,38}$/;

let currentPopover = null;
let currentSelection = null;

document.addEventListener("mouseup", () => {
  window.setTimeout(showSavePopover, 0);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    removePopover();
  }
});

document.addEventListener("scroll", removePopover, true);

function showSavePopover() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || "";

  if (!WORD_PATTERN.test(selectedText) || selectedText.includes(" ")) {
    removePopover();
    return;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (!rect.width && !rect.height) {
    removePopover();
    return;
  }

  currentSelection = {
    word: normalizeWord(selectedText),
    displayWord: selectedText,
    context: getContextSentence(selection.anchorNode, selectedText),
    sourceTitle: document.title,
    sourceUrl: location.href,
    createdAt: new Date().toISOString(),
    status: "learning"
  };

  removePopover();

  const popover = document.createElement("div");
  popover.className = "rwk-save-popover";
  popover.style.left = `${Math.min(window.scrollX + rect.left, window.scrollX + document.documentElement.clientWidth - 300)}px`;
  popover.style.top = `${window.scrollY + rect.bottom + 8}px`;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "收藏";
  button.addEventListener("click", saveCurrentSelection);

  const label = document.createElement("span");
  label.textContent = selectedText;

  popover.append(button, label);
  document.documentElement.appendChild(popover);
  currentPopover = popover;
}

async function saveCurrentSelection() {
  if (!currentSelection) return;

  updatePopoverButton("查询含义...");

  const { [RWK_STORAGE_KEY]: existingWords = [] } = await chrome.storage.local.get(RWK_STORAGE_KEY);
  const words = Array.isArray(existingWords) ? existingWords : [];
  const duplicateIndex = words.findIndex((item) => item.word === currentSelection.word);
  const meaningZh = words[duplicateIndex]?.meaningZh || await fetchMeaning(currentSelection.word);
  const nextEntry = {
    ...currentSelection,
    id: duplicateIndex >= 0 ? words[duplicateIndex].id : crypto.randomUUID(),
    meaningZh,
    seenCount: duplicateIndex >= 0 ? (words[duplicateIndex].seenCount || 1) + 1 : 1,
    updatedAt: new Date().toISOString()
  };

  if (duplicateIndex >= 0) {
    words.splice(duplicateIndex, 1, {
      ...words[duplicateIndex],
      ...nextEntry
    });
  } else {
    words.unshift(nextEntry);
  }

  await chrome.storage.local.set({ [RWK_STORAGE_KEY]: words });

  if (currentPopover) {
    currentPopover.classList.add("rwk-saved");
    updatePopoverButton(meaningZh ? "已收藏含义" : "已收藏");
    window.setTimeout(removePopover, 850);
  }
}

function fetchMeaning(word) {
  return chrome.runtime.sendMessage({ type: "translate-word", word })
    .then((response) => response?.meaningZh || "")
    .catch(() => "");
}

function updatePopoverButton(text) {
  const button = currentPopover?.querySelector("button");

  if (button) {
    button.textContent = text;
  }
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/^'+|'+$/g, "");
}

function getContextSentence(anchorNode, selectedText) {
  const text = anchorNode?.textContent || selectedText;
  const compactText = text.replace(/\s+/g, " ").trim();
  const escaped = selectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = compactText.match(new RegExp(`[^.!?]{0,120}\\b${escaped}\\b[^.!?]{0,120}[.!?]?`, "i"));

  return (match?.[0] || compactText || selectedText).trim();
}

function removePopover() {
  currentPopover?.remove();
  currentPopover = null;
}

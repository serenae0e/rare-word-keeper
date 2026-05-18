const STORAGE_KEY = "rareWordKeeper.words";

const state = {
  words: [],
  filter: "all",
  query: ""
};

const elements = {
  summary: document.querySelector("#summary"),
  exportButton: document.querySelector("#exportButton"),
  searchInput: document.querySelector("#searchInput"),
  segments: document.querySelectorAll(".segment"),
  emptyState: document.querySelector("#emptyState"),
  wordList: document.querySelector("#wordList"),
  template: document.querySelector("#wordTemplate")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  await loadWords();
  bindEvents();
  render();
  fillMissingMeanings();
}

async function loadWords() {
  const { [STORAGE_KEY]: savedWords = [] } = await chrome.storage.local.get(STORAGE_KEY);
  state.words = Array.isArray(savedWords) ? savedWords : [];
}

function bindEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  elements.segments.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      elements.segments.forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  elements.exportButton.addEventListener("click", exportCsv);
}

function render() {
  const filteredWords = getFilteredWords();

  elements.summary.textContent = `${state.words.length} 个单词`;
  elements.wordList.replaceChildren(...filteredWords.map(createWordCard));
  elements.emptyState.classList.toggle("visible", filteredWords.length === 0);
}

function getFilteredWords() {
  return state.words.filter((item) => {
    const matchesFilter = state.filter === "all" || item.status === state.filter;
    const haystack = `${item.word} ${item.meaningZh || ""} ${item.context || ""} ${item.sourceTitle || ""} ${item.sourceUrl || ""}`.toLowerCase();
    const matchesQuery = !state.query || haystack.includes(state.query);
    return matchesFilter && matchesQuery;
  });
}

function createWordCard(item) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".word-card");
  const word = fragment.querySelector(".word-card__word");
  const count = fragment.querySelector(".word-card__count");
  const meaning = fragment.querySelector(".word-card__meaning");
  const context = fragment.querySelector(".word-card__context");
  const source = fragment.querySelector(".word-card__source");
  const markButton = fragment.querySelector(".mark-button");
  const deleteButton = fragment.querySelector(".delete-button");

  word.textContent = item.word;
  count.textContent = `遇到 ${item.seenCount || 1} 次`;
  meaning.textContent = item.meaningZh || "正在补中文含义";
  context.textContent = item.context || "没有保存到上下文";
  source.textContent = item.sourceTitle || item.sourceUrl || "来源网页";
  source.href = item.sourceUrl || "#";
  markButton.textContent = item.status === "learned" ? "移回学习中" : "标记已记住";
  markButton.addEventListener("click", () => toggleStatus(item.id));
  deleteButton.addEventListener("click", () => deleteWord(item.id));

  return card;
}

async function toggleStatus(id) {
  state.words = state.words.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      status: item.status === "learned" ? "learning" : "learned",
      updatedAt: new Date().toISOString()
    };
  });

  await saveWords();
  render();
}

async function deleteWord(id) {
  state.words = state.words.filter((item) => item.id !== id);
  await saveWords();
  render();
}

async function saveWords() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state.words });
}

async function fillMissingMeanings() {
  const missingWords = state.words.filter((item) => !item.meaningZh).slice(0, 12);

  if (!missingWords.length) return;

  let changed = false;

  for (const item of missingWords) {
    const meaningZh = await fetchMeaning(item.word);

    if (!meaningZh) continue;

    state.words = state.words.map((wordItem) => (
      wordItem.id === item.id
        ? { ...wordItem, meaningZh, updatedAt: new Date().toISOString() }
        : wordItem
    ));
    changed = true;
    render();
  }

  if (changed) {
    await saveWords();
  }
}

function fetchMeaning(word) {
  return chrome.runtime.sendMessage({ type: "translate-word", word })
    .then((response) => response?.meaningZh || "")
    .catch(() => "");
}

function exportCsv() {
  const rows = [
    ["word", "meaning_zh", "status", "seen_count", "context", "source_title", "source_url", "created_at", "updated_at"],
    ...state.words.map((item) => [
      item.word,
      item.meaningZh || "",
      item.status,
      item.seenCount || 1,
      item.context || "",
      item.sourceTitle || "",
      item.sourceUrl || "",
      item.createdAt || "",
      item.updatedAt || ""
    ])
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  const blobUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = blobUrl;
  link.download = `rare-word-keeper-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(blobUrl);
}

function escapeCsvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

const TRANSLATION_ENDPOINT = "https://api.mymemory.translated.net/get";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "translate-word") return false;

  translateWord(message.word)
    .then((meaningZh) => sendResponse({ meaningZh }))
    .catch(() => sendResponse({ meaningZh: "" }));

  return true;
});

async function translateWord(word) {
  const cleanWord = String(word || "").trim().toLowerCase();

  if (!cleanWord) return "";

  const url = new URL(TRANSLATION_ENDPOINT);
  url.searchParams.set("q", cleanWord);
  url.searchParams.set("langpair", "en|zh-CN");

  const response = await fetch(url);

  if (!response.ok) return "";

  const data = await response.json();
  const translatedText = data?.responseData?.translatedText || "";
  return normalizeMeaning(translatedText, cleanWord);
}

function normalizeMeaning(value, originalWord) {
  const meaning = String(value || "").trim();

  if (!meaning || meaning.toLowerCase() === originalWord) {
    return "";
  }

  return meaning;
}

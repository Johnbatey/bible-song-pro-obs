const sampleData = {
  songs: [
    {
      id: "song-1",
      kind: "song",
      title: "Marvelous God",
      meta: "Song lyrics demo",
      reference: "Song Lyrics",
      main: "Marvelous God You are so good\nMarvelous God You are so good\nMarvelous God You are so good",
      secondary: ""
    },
    {
      id: "song-2",
      kind: "song",
      title: "You Are Worthy",
      meta: "Song lyrics demo",
      reference: "Song Lyrics",
      main: "You are worthy of my praise\nYou are worthy of my worship\nYou are worthy, Lord",
      secondary: ""
    }
  ],
  bible: [
    {
      id: "bible-1",
      kind: "bible",
      title: "John 3:16",
      meta: "Bible reference demo",
      reference: "John 3:16 (KJV)",
      main: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
      secondary: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life."
    },
    {
      id: "bible-2",
      kind: "bible",
      title: "Psalm 23:1",
      meta: "Bible reference demo",
      reference: "Psalm 23:1 (NKJV)",
      main: "The Lord is my shepherd;\nI shall not want.",
      secondary: "The Lord is my shepherd;\nI have all that I need."
    }
  ],
  setlist: [
    {
      id: "setlist-1",
      kind: "setlist",
      title: "Opening Worship Flow",
      meta: "Setlist demo",
      reference: "Setlist Preview",
      main: "1. Marvelous God\n2. John 3:16\n3. You Are Worthy",
      secondary: ""
    }
  ]
};

const state = {
  tab: "songs",
  query: "",
  mode: "full",
  theme: "skyline",
  lines: 3,
  bgType: "color",
  dual: false,
  selectedId: null,
  liveId: null
};

const listEl = document.getElementById("content-list");
const searchBox = document.getElementById("search-box");
const selectionTitle = document.getElementById("selection-title");
const itemKind = document.getElementById("item-kind");
const itemMeta = document.getElementById("item-meta");
const displayStage = document.getElementById("display-stage");
const displayReference = document.getElementById("display-reference");
const displayMain = document.getElementById("display-main");
const displaySecondary = document.getElementById("display-secondary");
const bgNote = document.getElementById("bg-note");
const goLiveBtn = document.getElementById("go-live-btn");

function getItems() {
  const items = sampleData[state.tab] || [];
  const q = state.query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    return [item.title, item.meta, item.main, item.reference]
      .join("\n")
      .toLowerCase()
      .includes(q);
  });
}

function getSelectedItem() {
  const groups = [...sampleData.songs, ...sampleData.bible, ...sampleData.setlist];
  return groups.find((item) => item.id === state.selectedId) || null;
}

function splitLines(text, maxLines) {
  const lines = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";
  return lines.slice(0, maxLines).join("\n");
}

function renderList() {
  const items = getItems();
  listEl.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "content-item";
    empty.innerHTML = "<strong>No demo items found</strong><span>Try a different search term.</span>";
    listEl.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `content-item${state.selectedId === item.id ? " active" : ""}`;
    button.innerHTML = `<strong>${item.title}</strong><span>${item.meta}</span>`;
    button.onclick = () => {
      state.selectedId = item.id;
      renderList();
      renderDetails();
    };
    listEl.appendChild(button);
  });
}

function renderDetails() {
  const item = getSelectedItem();
  if (!item) {
    selectionTitle.textContent = "Select an item";
    itemKind.textContent = "None";
    itemMeta.textContent = "Choose a song, Bible reference, or setlist item from the left panel.";
    displayReference.textContent = "";
    displayMain.textContent = "Demo output appears here.";
    displaySecondary.textContent = "";
    return;
  }
  selectionTitle.textContent = item.title;
  itemKind.textContent = item.kind.toUpperCase();
  itemMeta.textContent = item.meta;
  if (state.liveId !== item.id) return;
  renderDisplay();
}

function renderDisplay() {
  const item = getSelectedItem();
  if (!item) return;
  displayStage.className = `display-stage ${state.mode === "lt" ? "display-lt" : "display-full"} bg-${state.bgType}${state.dual && item.kind === "bible" ? " dual-active" : ""}`;
  displayReference.textContent = item.reference;
  displayMain.textContent = splitLines(item.main, Number(state.lines) || 3);
  displaySecondary.textContent = state.dual && item.kind === "bible"
    ? splitLines(item.secondary || "", Number(state.lines) || 3)
    : "";
  const notes = {
    color: "Solid color background selected.",
    gradient: "Gradient background selected.",
    image: "Image background demo selected.",
    video: "Video background demo selected."
  };
  bgNote.textContent = notes[state.bgType] || notes.color;
}

function bindControls() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      state.tab = btn.dataset.tab;
      state.selectedId = null;
      state.liveId = null;
      renderList();
      renderDetails();
    });
  });

  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");
      state.mode = btn.dataset.mode;
      renderDisplay();
    });
  });

  searchBox.addEventListener("input", () => {
    state.query = searchBox.value || "";
    renderList();
  });

  document.getElementById("theme-select").addEventListener("change", (e) => {
    state.theme = e.target.value;
    document.querySelector(".demo-app").dataset.theme = state.theme;
  });

  document.getElementById("lines-select").addEventListener("change", (e) => {
    state.lines = Number(e.target.value) || 3;
    renderDisplay();
  });

  document.getElementById("bg-type-select").addEventListener("change", (e) => {
    state.bgType = e.target.value;
    renderDisplay();
  });

  document.getElementById("dual-toggle").addEventListener("change", (e) => {
    state.dual = !!e.target.checked;
    renderDisplay();
  });

  goLiveBtn.addEventListener("click", () => {
    const item = getSelectedItem();
    if (!item) return;
    state.liveId = item.id;
    renderDisplay();
    renderDetails();
  });
}

bindControls();
renderList();
renderDetails();

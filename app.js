const audioById = {
  1: "Audio/02_final_penalty.wav",
  2: "Audio/01_tony_adams.wav",
  3: "Audio/04_henry_goal.wav",
  5: "Audio/03_invincibles_clincher.wav",
  7: "Audio/07_Wenger.wav",
  11: "Audio/05_Pires.wav",
  12: "Audio/06_1989_miracle.wav",
};

const supplementalEvents = [
  {
    id: 11,
    title: "Pires Highbury Finish",
    x: 63,
    y: 72,
    anchor: "South half, East of center",
    audioUrl: audioById[11],
  },
  {
    id: 12,
    title: "1989 Title Miracle Tribute",
    x: 50,
    y: 96,
    anchor: "Clock End goal line, archival memory marker",
    audioUrl: audioById[12],
  },
];

const elements = {
  eventCount: document.querySelector("#event-count"),
  audioCount: document.querySelector("#audio-count"),
  markerLayer: document.querySelector("#marker-layer"),
  eventTitle: document.querySelector("#event-title"),
  eventId: document.querySelector("#event-id"),
  eventCoordinates: document.querySelector("#event-coordinates"),
  eventAnchor: document.querySelector("#event-anchor"),
  audioPill: document.querySelector("#audio-pill"),
  playButton: document.querySelector("#play-button"),
  playerHint: document.querySelector("#player-hint"),
  eventList: document.querySelector("#event-list"),
  listSummary: document.querySelector("#list-summary"),
};

const audioCache = new Map();
let activeAudio = null;
let selectedEventId = null;

boot().catch((error) => {
  console.error(error);
  elements.listSummary.textContent = "Could not load events.csv. Serve the folder over HTTP and refresh.";
  elements.eventAnchor.textContent = "Loading failed. A simple local server such as python -m http.server will fix CSV fetching.";
});

async function boot() {
  const events = await loadEvents("events.csv");
  const audioReadyCount = preloadAudio(events);

  elements.eventCount.textContent = String(events.length);
  elements.audioCount.textContent = String(audioReadyCount);
  elements.listSummary.textContent = `${audioReadyCount} commentary clips ready, ${events.length - audioReadyCount} placeholders`;

  renderMarkers(events);
  renderEventList(events);

  const firstPlayableEvent = events.find((event) => event.audioUrl) ?? events[0];
  if (firstPlayableEvent) {
    selectEvent(firstPlayableEvent, { shouldAutoplay: false });
  }
}

async function loadEvents(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }

  const csvText = await response.text();
  const rows = parseCsv(csvText);

  const csvEvents = rows.map((row) => ({
    id: Number(row.ID),
    title: row.Event,
    x: Number(row["X (West to East)"]),
    y: Number(row["Y (North to South)"]),
    anchor: row["Key Visual Anchor"] || "No anchor description yet.",
    audioUrl: audioById[Number(row.ID)] || "",
  }));

  return [...csvEvents, ...supplementalEvents].sort((left, right) => left.id - right.id);
}

function renderMarkers(events) {
  const fragment = document.createDocumentFragment();

  events.forEach((event) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `marker-button${event.audioUrl ? " has-audio" : ""}`;
    button.style.left = `${event.x}%`;
    button.style.top = `${event.y}%`;
    button.dataset.eventId = String(event.id);
    button.setAttribute(
      "aria-label",
      `${event.title}${event.audioUrl ? ", commentary available" : ", commentary coming soon"}`
    );

    button.addEventListener("click", () => {
      selectEvent(event, { shouldAutoplay: Boolean(event.audioUrl) });
    });

    fragment.appendChild(button);
  });

  elements.markerLayer.replaceChildren(fragment);
}

function renderEventList(events) {
  const fragment = document.createDocumentFragment();

  events.forEach((event) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "event-row";
    row.dataset.eventId = String(event.id);

    const statusText = event.audioUrl ? "Clip ready" : "No clip";
    row.innerHTML = `
      <span class="event-number">${event.id}</span>
      <span class="event-copy">
        <strong>${escapeHtml(event.title)}</strong>
        <span>${escapeHtml(event.anchor)}</span>
      </span>
      <span class="event-status${event.audioUrl ? " has-audio" : ""}">${statusText}</span>
    `;

    row.addEventListener("click", () => {
      selectEvent(event, { shouldAutoplay: Boolean(event.audioUrl) });
    });

    fragment.appendChild(row);
  });

  elements.eventList.replaceChildren(fragment);
}

function selectEvent(event, options = {}) {
  selectedEventId = event.id;
  updateSelectionStyles();

  elements.eventTitle.textContent = event.title;
  elements.eventId.textContent = String(event.id);
  elements.eventCoordinates.textContent = `${event.x}% east, ${event.y}% south`;
  elements.eventAnchor.textContent = event.anchor;
  elements.playButton.disabled = !event.audioUrl;
  elements.playButton.onclick = event.audioUrl ? () => playAudio(event.audioUrl) : null;

  if (event.audioUrl) {
    elements.audioPill.textContent = "Commentary clip ready";
    elements.audioPill.classList.add("has-audio");
    elements.playerHint.textContent = "This marker has a preloaded clip. Click play or choose another hotspot to switch instantly.";
    if (options.shouldAutoplay) {
      void playAudio(event.audioUrl);
    }
    return;
  }

  stopActiveAudio();
  elements.audioPill.textContent = "Audio coming soon";
  elements.audioPill.classList.remove("has-audio");
  elements.playerHint.textContent = "This event is wired up from the CSV already, but no audio file has been assigned yet.";
}

async function playAudio(url) {
  stopActiveAudio();

  const audio = getAudio(url);
  activeAudio = audio;
  audio.currentTime = 0;

  try {
    await audio.play();
  } catch (error) {
    console.error(error);
    elements.playerHint.textContent = "Playback was blocked by the browser. Click the play button again to retry.";
  }
}

function preloadAudio(events) {
  const uniqueUrls = [...new Set(events.map((event) => event.audioUrl).filter(Boolean))];

  uniqueUrls.forEach((url) => {
    const audio = new Audio(url);
    audio.preload = "auto";
    audioCache.set(url, audio);
    audio.load();
  });

  return uniqueUrls.length;
}

function getAudio(url) {
  if (!audioCache.has(url)) {
    const audio = new Audio(url);
    audio.preload = "auto";
    audioCache.set(url, audio);
  }

  return audioCache.get(url);
}

function stopActiveAudio() {
  if (!activeAudio) {
    return;
  }

  activeAudio.pause();
  activeAudio.currentTime = 0;
  activeAudio = null;
}

function updateSelectionStyles() {
  const id = String(selectedEventId);

  elements.markerLayer
    .querySelectorAll(".marker-button")
    .forEach((button) => button.classList.toggle("is-active", button.dataset.eventId === id));

  elements.eventList
    .querySelectorAll(".event-row")
    .forEach((row) => row.classList.toggle("is-active", row.dataset.eventId === id));
}

function parseCsv(csvText) {
  const rows = [];
  let current = "";
  let row = [];
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];
    const nextCharacter = csvText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }

      row.push(current);
      current = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    current += character;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  return dataRows.map((dataRow) =>
    headers.reduce((record, header, index) => {
      record[header] = dataRow[index] ?? "";
      return record;
    }, {})
  );
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

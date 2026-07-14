import {
  DEFAULT_LIMIT,
  fetchFullLeaderboard,
  findCurrentUserEntry,
  normalizeValue,
} from "./leaderboard.js";

const THM_ORIGIN = "https://tryhackme.com";
const extensionApi = globalThis.browser ?? globalThis.chrome;

const state = {
  entries: [],
  currentUser: null,
  currentRoomCode: "",
  tryHackMeTabId: null,
  isLoading: false,
};

const els = {
  roomCodeInput: document.querySelector("#roomCodeInput"),
  limitInput: document.querySelector("#limitInput"),
  loadButton: document.querySelector("#loadButton"),
  refreshButton: document.querySelector("#refreshButton"),
  status: document.querySelector("#status"),
  mePanel: document.querySelector("#mePanel"),
  meRank: document.querySelector("#meRank"),
  meName: document.querySelector("#meName"),
  meMeta: document.querySelector("#meMeta"),
  searchInput: document.querySelector("#searchInput"),
  resultCount: document.querySelector("#resultCount"),
  leaderboardBody: document.querySelector("#leaderboardBody"),
};

document.addEventListener("DOMContentLoaded", init);
els.loadButton.addEventListener("click", () => loadLeaderboardFromInput());
els.refreshButton.addEventListener("click", () => loadLeaderboardFromInput());
els.searchInput.addEventListener("input", renderLeaderboard);
els.roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    loadLeaderboardFromInput();
  }
});

async function init() {
  const activeTryHackMeTab = await getActiveTryHackMeTab();
  const detectedRoomCode = getRoomCodeFromUrl(activeTryHackMeTab?.url || "");
  const user = await getLoggedInUser();

  state.tryHackMeTabId = activeTryHackMeTab?.id || null;
  state.currentUser = user;
  if (detectedRoomCode) {
    els.roomCodeInput.value = detectedRoomCode;
    await loadLeaderboard(detectedRoomCode);
    return;
  }

  renderCurrentUser(null);
  setStatus(
    user
      ? `Signed in as ${user.username}. Enter a room code to load a leaderboard.`
      : "Enter a room code to load a leaderboard.",
  );
}

async function getActiveTryHackMeTab() {
  const [tab] = await extensionApi.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.url) {
    return null;
  }

  try {
    const url = new URL(tab.url);
    if (url.hostname !== "tryhackme.com") {
      return null;
    }

    return tab;
  } catch {
    return null;
  }
}

function getRoomCodeFromUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/room\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  } catch {
    return "";
  }
}

async function getLoggedInUser() {
  const cookie = await extensionApi.cookies.get({
    url: THM_ORIGIN,
    name: "thm-ud",
  });
  if (!cookie?.value) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(cookie.value);
    const parsed = JSON.parse(decoded);
    return {
      id: normalizeValue(parsed.id),
      username: normalizeValue(parsed.username),
    };
  } catch {
    return null;
  }
}

async function loadLeaderboardFromInput() {
  const roomCode = els.roomCodeInput.value.trim();
  await loadLeaderboard(roomCode);
}

async function loadLeaderboard(roomCode) {
  if (!roomCode) {
    setStatus("Enter a room code first.", true);
    return;
  }

  setLoading(true);
  state.currentRoomCode = roomCode;
  state.entries = [];
  renderLeaderboard();
  renderCurrentUser(null);

  try {
    const limit = Number.parseInt(els.limitInput.value, 10) || DEFAULT_LIMIT;
    const entries = await fetchFullLeaderboard({
      roomCode,
      limit,
      fetchPage: fetchScoreboardPage,
      onProgress: ({ page, entriesLoaded }) => {
        setStatus(
          `Loading page ${page}... ${entriesLoaded.toLocaleString()} users found.`,
        );
      },
    });
    state.entries = entries;

    const match = findCurrentUserEntry(entries, state.currentUser);
    renderCurrentUser(match);
    renderLeaderboard();

    if (entries.length === 0) {
      setStatus(`No leaderboard entries returned for ${roomCode}.`);
    } else {
      setStatus(
        `Loaded ${entries.length.toLocaleString()} leaderboard entr${entries.length === 1 ? "y" : "ies"} for ${roomCode}.`,
      );
    }
  } catch (error) {
    state.entries = [];
    renderLeaderboard();
    renderCurrentUser(null);
    setStatus(error.message || "Could not load the leaderboard.", true);
  } finally {
    setLoading(false);
  }
}

async function fetchScoreboardPage({ roomCode, limit, page }) {
  if (state.tryHackMeTabId) {
    try {
      return await fetchScoreboardPageFromTryHackMeTab(
        state.tryHackMeTabId,
        roomCode,
        limit,
        page,
      );
    } catch {
      return fetchScoreboardPageFromExtension(roomCode, limit, page);
    }
  }

  return fetchScoreboardPageFromExtension(roomCode, limit, page);
}

async function fetchScoreboardPageFromTryHackMeTab(
  tabId,
  roomCode,
  limit,
  page,
) {
  const [result] = await extensionApi.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [roomCode, limit, page],
    func: async (injectedRoomCode, injectedLimit, injectedPage) => {
      const url = new URL("/api/v2/rooms/scoreboard", window.location.origin);
      url.searchParams.set("roomCode", injectedRoomCode);
      url.searchParams.set("limit", String(injectedLimit));
      url.searchParams.set("page", String(injectedPage));

      const response = await fetch(url.toString(), {
        credentials: "include",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
        };
      }

      return {
        ok: true,
        data: await response.json(),
      };
    },
  });

  const payload = result?.result;
  if (!payload?.ok) {
    throw new Error(
      `TryHackMe returned HTTP ${payload?.status || "unknown"} for page ${page}.`,
    );
  }

  return payload.data;
}

async function fetchScoreboardPageFromExtension(roomCode, limit, page) {
  const url = new URL("/api/v2/rooms/scoreboard", THM_ORIGIN);
  url.searchParams.set("roomCode", roomCode);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("page", String(page));

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: {
      accept: "application/json",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "TryHackMe refused the request. Make sure you are logged in on tryhackme.com, then try again.",
    );
  }

  if (!response.ok) {
    throw new Error(
      `TryHackMe returned HTTP ${response.status} for page ${page}.`,
    );
  }

  return response.json();
}

function renderCurrentUser(entry) {
  if (!state.currentUser && !entry) {
    els.mePanel.classList.add("hidden");
    return;
  }

  els.mePanel.classList.remove("hidden");
  els.meName.textContent =
    entry?.username || state.currentUser?.username || "Signed-in user";

  if (entry) {
    els.meRank.textContent = `#${entry.rank}`;
    els.meMeta.textContent = `Score ${formatNumber(entry.score)}${entry.completedAt ? ` • Completed ${formatDate(entry.completedAt)}` : ""}`;
    return;
  }

  els.meRank.textContent = "-";
  els.meMeta.textContent = "Not found in the loaded leaderboard.";
}

function renderLeaderboard() {
  const query = els.searchInput.value.trim().toLowerCase();
  const visibleEntries = query
    ? state.entries.filter(
        (entry) =>
          entry.username.toLowerCase().includes(query) ||
          entry.id.toLowerCase().includes(query),
      )
    : state.entries;

  els.resultCount.textContent = `${visibleEntries.length.toLocaleString()} user${visibleEntries.length === 1 ? "" : "s"}`;

  if (visibleEntries.length === 0) {
    const row = document.createElement("tr");
    const cell = createCell(
      state.entries.length ? "No matching users." : "No leaderboard loaded.",
      "empty",
    );
    cell.colSpan = 4;
    row.append(cell);
    els.leaderboardBody.replaceChildren(row);
    return;
  }

  const currentEntry = findCurrentUserEntry(visibleEntries, state.currentUser);
  els.leaderboardBody.replaceChildren(
    ...visibleEntries.map((entry) => {
      const row = document.createElement("tr");
      if (
        currentEntry &&
        entry.rank === currentEntry.rank &&
        entry.username === currentEntry.username
      ) {
        row.classList.add("current-user");
      }

      row.append(
        createCell(`#${entry.rank}`),
        createUserCell(entry),
        createCell(formatNumber(entry.score), "score"),
        createCell(entry.completedAt ? formatDate(entry.completedAt) : "-"),
      );

      return row;
    }),
  );
}

function createUserCell(entry) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  const username = document.createElement("span");
  const meta = document.createElement("span");

  wrapper.className = "user-cell";
  username.className = "username";
  username.textContent = entry.username;
  meta.className = "subtle";
  meta.textContent =
    entry.displayName && entry.displayName !== entry.username
      ? entry.displayName
      : entry.id || "";

  wrapper.append(username, meta);
  cell.append(wrapper);
  return cell;
}

function createCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) {
    cell.className = className;
  }
  return cell;
}

function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  els.loadButton.disabled = isLoading;
  els.refreshButton.disabled = isLoading;
  els.loadButton.textContent = isLoading ? "Loading" : "Load";
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

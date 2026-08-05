import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_PAGES,
  fetchLeaderboardPages,
  findCurrentUserEntry,
  formatLevel,
  getScoreboardHttpErrorMessage,
  normalizeValue,
} from "./leaderboard.js";

const THM_ORIGIN = "https://tryhackme.com";
const extensionApi = globalThis.browser ?? globalThis.chrome;

const state = {
  entries: [],
  currentUser: null,
  currentRoomCode: "",
  tryHackMeTabId: null,
  nextPage: 1,
  hasMore: false,
  isLoading: false,
};

const els = {
  roomCodeInput: document.querySelector("#roomCodeInput"),
  loadButton: document.querySelector("#loadButton"),
  loadMoreButton: document.querySelector("#loadMoreButton"),
  refreshButton: document.querySelector("#refreshButton"),
  status: document.querySelector("#status"),
  mePanel: document.querySelector("#mePanel"),
  meRank: document.querySelector("#meRank"),
  meName: document.querySelector("#meName"),
  meMeta: document.querySelector("#meMeta"),
  searchInput: document.querySelector("#searchInput"),
  resultCount: document.querySelector("#resultCount"),
  leaderboardHeadRow: document.querySelector("#leaderboardHeadRow"),
  leaderboardBody: document.querySelector("#leaderboardBody"),
};

document.addEventListener("DOMContentLoaded", init);
els.loadButton.addEventListener("click", () => loadLeaderboardFromInput());
els.loadMoreButton.addEventListener("click", loadMoreLeaderboard);
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
  state.nextPage = 1;
  state.hasMore = false;
  renderLeaderboard();
  renderLoadMoreButton();
  renderCurrentUser(null);

  try {
    const result = await fetchLeaderboardPages({
      roomCode,
      user: state.currentUser,
      limit: DEFAULT_LIMIT,
      maxPages: MAX_PAGES,
      pagesToFetch: state.currentUser ? MAX_PAGES : 1,
      stopWhenUserFound: Boolean(state.currentUser),
      fetchPage: fetchScoreboardPage,
      onProgress: ({ page, entriesLoaded }) => {
        setStatus(
          `Loading page ${page}... ${entriesLoaded.toLocaleString()} users found.`,
        );
      },
    });
    state.entries = result.entries;
    state.nextPage = result.nextPage;
    state.hasMore = result.hasMore;

    renderCurrentUser(result.currentUserEntry);
    renderLeaderboard();
    renderLoadMoreButton();

    if (state.entries.length === 0) {
      setStatus(`No leaderboard entries returned for ${roomCode}.`);
    } else if (result.repeatedPage) {
      setStatus(getPaginationUnavailableStatus(result.currentUserEntry));
    } else if (result.currentUserEntry && result.hasMore) {
      setStatus(
        `Loaded ${state.entries.length.toLocaleString()} users through your position. Load more to see the remaining leaderboard.`,
      );
    } else if (!state.currentUser && result.hasMore) {
      setStatus(
        `Loaded the first ${state.entries.length.toLocaleString()} users. Load more to continue.`,
      );
    } else if (state.currentUser && !result.currentUserEntry) {
      setStatus(
        `Loaded ${state.entries.length.toLocaleString()} users, but your account was not found in this leaderboard.`,
      );
    } else {
      setStatus(
        `Loaded all ${state.entries.length.toLocaleString()} leaderboard entries for ${roomCode}.`,
      );
    }
  } catch (error) {
    state.entries = [];
    state.nextPage = 1;
    state.hasMore = false;
    renderLeaderboard();
    renderLoadMoreButton();
    renderCurrentUser(null);
    setStatus(error.message || "Could not load the leaderboard.", true);
  } finally {
    setLoading(false);
  }
}

async function loadMoreLeaderboard() {
  if (!state.currentRoomCode || !state.hasMore || state.isLoading) {
    return;
  }

  setLoading(true);

  try {
    const result = await fetchLeaderboardPages({
      roomCode: state.currentRoomCode,
      user: state.currentUser,
      limit: DEFAULT_LIMIT,
      startPage: state.nextPage,
      existingEntries: state.entries,
      maxPages: MAX_PAGES,
      pagesToFetch: 1,
      fetchPage: fetchScoreboardPage,
      onProgress: ({ page, entriesLoaded }) => {
        setStatus(
          `Loading page ${page}... ${entriesLoaded.toLocaleString()} users loaded.`,
        );
      },
    });

    state.entries = result.entries;
    state.nextPage = result.nextPage;
    state.hasMore = result.hasMore;
    renderCurrentUser(result.currentUserEntry);
    renderLeaderboard();
    renderLoadMoreButton();
    if (result.repeatedPage) {
      setStatus(getPaginationUnavailableStatus(result.currentUserEntry));
    } else {
      setStatus(
        result.hasMore
          ? `Loaded ${state.entries.length.toLocaleString()} users. Load more to continue.`
          : `Loaded all ${state.entries.length.toLocaleString()} leaderboard entries for ${state.currentRoomCode}.`,
      );
    }
  } catch (error) {
    setStatus(error.message || "Could not load more users.", true);
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
    throw new Error(getScoreboardHttpErrorMessage(payload?.status, page));
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
      "TryHackMe does not expose this leaderboard without authentication.",
    );
  }

  if (!response.ok) {
    throw new Error(getScoreboardHttpErrorMessage(response.status, page));
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
    els.meRank.textContent = entry.rankLabel;
    const solvedSummary = formatProgress(entry);
    els.meMeta.textContent = [
      `Score ${formatNumber(entry.score)}`,
      entry.level === null ? "" : formatLevel(entry.level),
      solvedSummary,
    ]
      .filter(Boolean)
      .join(" • ");
    return;
  }

  els.meRank.textContent = "-";
  els.meMeta.textContent = "Not found in the loaded leaderboard.";
}

function renderLeaderboard() {
  const questionColumns = getQuestionColumns(state.entries);
  renderTableHeader(questionColumns);
  const query = els.searchInput.value.trim().toLowerCase();
  const visibleEntries = query
    ? state.entries.filter(
        (entry) =>
          entry.username.toLowerCase().includes(query) ||
          entry.displayName.toLowerCase().includes(query),
      )
    : state.entries;

  const isTeamLeaderboard = state.entries.some((entry) => entry.isTeam);
  const entityName = isTeamLeaderboard ? "team" : "user";
  els.resultCount.textContent = `${visibleEntries.length.toLocaleString()} ${entityName}${visibleEntries.length === 1 ? "" : "s"}`;

  if (visibleEntries.length === 0) {
    const row = document.createElement("tr");
    const cell = createCell(
      state.entries.length ? "No matching users." : "No leaderboard loaded.",
      "empty",
    );
    cell.colSpan = 6 + questionColumns.length;
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

      const questionsByKey = new Map(
        entry.questions.map((question) => [questionKey(question), question]),
      );

      row.append(
        createCell(entry.rankLabel),
        createUserCell(entry),
        createCell(formatLevel(entry.level), "level"),
        createCell(formatNumber(entry.score), "score"),
        createTimestampCell(entry.timeScored, "time-scored"),
        ...questionColumns.map((column) =>
          createQuestionCell(questionsByKey.get(column.key)),
        ),
        createTimestampCell(entry.lastSolvedAt, "last-solved"),
      );

      return row;
    }),
  );
}

function createUserCell(entry) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  const details = document.createElement("div");
  const username = document.createElement(entry.isTeam ? "span" : "a");
  const meta = document.createElement("span");

  wrapper.className = "user-cell";
  details.className = "user-details";
  username.className = "username";
  username.textContent = entry.username;
  if (!entry.isTeam) {
    username.href = `${THM_ORIGIN}/p/${encodeURIComponent(entry.username)}`;
    username.target = "_blank";
    username.rel = "noopener noreferrer";
  }
  meta.className = "subtle";
  meta.textContent = entry.isTeam
    ? "Team"
    : entry.displayName && entry.displayName !== entry.username
      ? entry.displayName
      : "";

  if (entry.avatar) {
    const avatarUrl = getSafeAvatarUrl(entry.avatar);
    if (avatarUrl) {
      const avatar = document.createElement("img");
      avatar.className = "user-avatar";
      avatar.src = avatarUrl;
      avatar.alt = "";
      avatar.loading = "lazy";
      avatar.referrerPolicy = "no-referrer";
      avatar.addEventListener("error", () => avatar.remove(), { once: true });
      wrapper.append(avatar);
    }
  }

  details.append(username, meta);
  wrapper.append(details);
  cell.append(wrapper);
  return cell;
}

function createQuestionCell(question) {
  const cell = document.createElement("td");
  cell.className = "question-cell";

  if (!question) {
    cell.textContent = "-";
    return cell;
  }

  const score = document.createElement("strong");
  const timestamp = document.createElement("code");
  const metadata = document.createElement("span");

  score.textContent = `${formatNumber(question.score)} pts`;
  timestamp.className = "raw-timestamp";
  timestamp.textContent = question.timeCorrect
    ? `timeCorrect: ${question.timeCorrect}`
    : "timeCorrect: not provided";
  metadata.className = "subtle";
  metadata.textContent = [
    question.correct ? "correct" : "not correct",
    `${question.attempts.toLocaleString()} attempt${question.attempts === 1 ? "" : "s"}`,
    question.answeredBy ? `answeredBy: ${question.answeredBy}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  cell.append(score, timestamp, metadata);
  return cell;
}

function getQuestionColumns(entries) {
  const columns = new Map();

  entries.forEach((entry) => {
    entry.questions.forEach((question) => {
      const key = questionKey(question);
      if (!columns.has(key)) {
        columns.set(key, {
          key,
          taskNo: question.taskNo,
          questionNo: question.questionNo,
        });
      }
    });
  });

  return [...columns.values()].sort((a, b) => {
    const taskComparison = compareQuestionPart(a.taskNo, b.taskNo);
    return taskComparison || compareQuestionPart(a.questionNo, b.questionNo);
  });
}

function renderTableHeader(questionColumns) {
  const headers = [
    createHeaderCell("Rank"),
    createHeaderCell("User / team"),
    createHeaderCell("Level"),
    createHeaderCell("Total score"),
    createHeaderCell(
      "THM timeScored",
      "Raw ranking timestamp returned by TryHackMe; it may not match the actual answer times.",
    ),
    ...questionColumns.map((column) =>
      createHeaderCell(`Task ${column.taskNo} · Q${column.questionNo}`),
    ),
    createHeaderCell("Last timeCorrect"),
  ];

  els.leaderboardHeadRow.replaceChildren(...headers);
}

function createHeaderCell(text, title = "") {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = text;
  if (title) {
    cell.title = title;
  }
  return cell;
}

function questionKey(question) {
  return `${question.taskNo}:${question.questionNo}`;
}

function compareQuestionPart(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
  });
}

function createTimestampCell(value, className) {
  const cell = document.createElement("td");
  cell.className = className;

  if (!value) {
    cell.textContent = "-";
    return cell;
  }

  const formatted = document.createElement("time");
  const raw = document.createElement("code");
  formatted.dateTime = value;
  formatted.textContent = formatDate(value);
  raw.className = "raw-timestamp";
  raw.textContent = value;
  cell.append(formatted, raw);
  return cell;
}

function getSafeAvatarUrl(value) {
  try {
    const url = new URL(value, THM_ORIGIN);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function formatProgress(entry) {
  if (!entry.solvedCount && !entry.attemptCount) {
    return "";
  }

  return `${entry.solvedCount.toLocaleString()} solved in ${entry.attemptCount.toLocaleString()} attempt${entry.attemptCount === 1 ? "" : "s"}`;
}

function renderLoadMoreButton() {
  els.loadMoreButton.classList.toggle("hidden", !state.hasMore);
  els.loadMoreButton.disabled = state.isLoading;
}

function getPaginationUnavailableStatus(currentUserEntry) {
  const loadedCount = state.entries.length.toLocaleString();
  const cutoff =
    state.entries.length >= MAX_LIMIT
      ? `top ${MAX_LIMIT.toLocaleString()} users`
      : `first ${loadedCount} users`;
  const currentUserMessage =
    state.currentUser && !currentUserEntry
      ? " Your account was not found within that cutoff."
      : "";

  return `TryHackMe is repeating the ${cutoff} for this room instead of paginating, so no additional users can be loaded.${currentUserMessage}`;
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
  els.loadMoreButton.disabled = isLoading;
  els.loadButton.textContent = isLoading ? "Loading" : "Load";
  els.loadMoreButton.textContent = isLoading
    ? "Loading more users..."
    : "Load more users";
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

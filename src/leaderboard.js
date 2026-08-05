export const DEFAULT_LIMIT = 250;
export const MAX_LIMIT = 500;
export const MAX_PAGES = 200;
export const LEVEL_TITLES = {
  1: "Neophyte",
  2: "Apprentice",
  3: "Pathfinder",
  4: "Seeker",
  5: "Visionary",
  6: "Voyager",
  7: "Adept",
  8: "Hacker",
  9: "Mage",
  10: "Wizard",
  11: "Master",
  12: "Guru",
  13: "Legend",
  14: "Guardian",
  15: "Titan",
  16: "Sage",
  17: "Vanguard",
  18: "Shogun",
  19: "Ascended",
  20: "Mythic",
  21: "Grandmaster",
};

export async function fetchLeaderboardPages({
  roomCode,
  user = null,
  limit = DEFAULT_LIMIT,
  startPage = 1,
  existingEntries = [],
  maxPages = MAX_PAGES,
  pagesToFetch = maxPages,
  stopWhenUserFound = false,
  fetchPage,
  onProgress = () => {},
}) {
  const entries = [...existingEntries];
  const seenKeys = new Set(entries.map(entryKey).filter(Boolean));
  const keyIndexes = new Map(
    entries
      .map((entry, index) => [entryKey(entry), index])
      .filter(([key]) => Boolean(key)),
  );
  let nextPage = startPage;
  let hasMore = false;
  let pagesFetched = 0;
  let repeatedPage = false;

  for (
    let page = startPage;
    page <= maxPages && pagesFetched < pagesToFetch;
    page += 1
  ) {
    onProgress({ page, entriesLoaded: entries.length });
    const data = await fetchPage({ roomCode, limit, page });
    const pageEntries = extractEntries(data);
    pagesFetched += 1;
    nextPage = page + 1;

    if (pageEntries.length === 0) {
      hasMore = false;
      break;
    }

    let newEntries = 0;
    pageEntries.forEach((rawEntry, index) => {
      const normalized = normalizeEntry(
        rawEntry,
        (page - 1) * limit + index + 1,
      );
      const key = entryKey(normalized) || `${page}:${index}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        keyIndexes.set(key, entries.length);
        entries.push(normalized);
        newEntries += 1;
      } else {
        replacePersonalizedRank(entries, keyIndexes.get(key), normalized);
      }
    });

    repeatedPage = newEntries === 0;
    hasMore = pageEntries.length >= limit && !repeatedPage;

    if (repeatedPage && limit === DEFAULT_LIMIT) {
      const expandedData = await fetchPage({
        roomCode,
        limit: MAX_LIMIT,
        page: 1,
      });
      const expandedEntries = extractEntries(expandedData);
      pagesFetched += 1;

      expandedEntries.forEach((rawEntry, index) => {
        const normalized = normalizeEntry(rawEntry, index + 1);
        const key = entryKey(normalized) || `expanded:${index}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          keyIndexes.set(key, entries.length);
          entries.push(normalized);
        } else {
          replacePersonalizedRank(entries, keyIndexes.get(key), normalized);
        }
      });
    }

    const currentUserEntry = findCurrentUserEntry(entries, user);

    if (
      repeatedPage ||
      !hasMore ||
      (stopWhenUserFound && currentUserEntry?.hasNumericRank)
    ) {
      break;
    }
  }

  const sortedEntries = entries.sort((a, b) => a.rank - b.rank);

  return {
    entries: sortedEntries,
    currentUserEntry: findCurrentUserEntry(sortedEntries, user),
    nextPage,
    hasMore,
    pagesFetched,
    repeatedPage,
  };
}

export async function fetchFullLeaderboard(options) {
  const result = await fetchLeaderboardPages(options);
  return result.entries;
}

export function extractEntries(data) {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data?.data,
    data?.data?.docs,
    data?.data?.scoreboard,
    data?.data?.scoreboard?.docs,
    data?.data?.leaderboard,
    data?.data?.leaderboard?.docs,
    data?.data?.results,
    data?.data?.users,
    data?.data?.items,
    data?.scoreboard,
    data?.scoreboard?.docs,
    data?.leaderboard,
    data?.leaderboard?.docs,
    data?.docs,
    data?.results,
    data?.users,
    data?.items,
  ];

  return candidates.find(Array.isArray) || [];
}

export function normalizeEntry(entry, fallbackRank) {
  const user = entry.user || entry.userInfo || entry.profile || {};
  const username = firstString(
    entry.username,
    entry.name,
    entry.userName,
    user.username,
    user.name,
  );
  const displayName = firstString(
    entry.displayName,
    entry.fullName,
    user.displayName,
    user.fullName,
  );
  const avatar = firstString(
    entry.avatar,
    entry.avatarUrl,
    user.avatar,
    user.avatarUrl,
  );
  const level = firstOptionalNumber(
    entry.level,
    entry.userLevel,
    user.level,
    user.userLevel,
  );
  const teamId = firstString(entry.teamId);
  const id = firstString(
    entry.userId,
    teamId,
    entry.id,
    entry._id,
    user.id,
    user._id,
  );
  const rawRank = firstString(entry.rank, entry.position, entry.place);
  const numericRank = firstOptionalNumber(
    entry.rank,
    entry.position,
    entry.place,
  );
  const rank = numericRank ?? fallbackRank;
  const score = firstNumber(
    entry.score,
    entry.points,
    entry.totalScore,
    entry.value,
    0,
  );
  const completedAt = firstString(
    entry.completedAt,
    entry.completed,
    entry.completionDate,
    entry.createdAt,
    entry.date,
  );
  const taskSummary = summarizeTasks(entry.tasks);

  return {
    raw: entry,
    id,
    username: username || displayName || "Unknown user",
    displayName,
    avatar,
    level,
    isTeam: Boolean(teamId),
    isCurrentTeam: entry.isCurrentTeam === true,
    rank,
    rankLabel:
      numericRank === null ? rawRank || `#${fallbackRank}` : `#${numericRank}`,
    hasNumericRank: numericRank !== null,
    score,
    timeScored: firstString(entry.timeScored),
    completedAt,
    solvedCount: taskSummary.solvedCount,
    attemptCount: taskSummary.attemptCount,
    lastSolvedAt: taskSummary.lastSolvedAt || completedAt,
    questions: taskSummary.questions,
  };
}

export function summarizeTasks(tasks) {
  if (!tasks || typeof tasks !== "object" || Array.isArray(tasks)) {
    return {
      solvedCount: 0,
      attemptCount: 0,
      lastSolvedAt: "",
      questions: [],
    };
  }

  const questions = Object.entries(tasks).flatMap(([taskNo, task]) =>
    Array.isArray(task)
      ? task.map((question, index) => ({
          taskNo: normalizeValue(taskNo),
          questionNo: firstOptionalNumber(question?.questionNo) ?? index + 1,
          correct: question?.correct === true,
          score: firstNumber(question?.score, 0),
          attempts: Math.max(0, firstNumber(question?.attempts, 0)),
          timeCorrect: firstString(question?.timeCorrect),
          answeredBy: firstString(
            question?.answeredBy?.username,
            question?.answeredBy?.name,
          ),
        }))
      : [],
  );
  const solvedQuestions = questions.filter(
    (question) => question?.correct === true,
  );
  const attemptCount = questions.reduce(
    (total, question) => total + question.attempts,
    0,
  );
  const latestCorrectTime = solvedQuestions
    .map((question) => firstString(question?.timeCorrect))
    .filter(Boolean)
    .map((value) => ({ value, timestamp: Date.parse(value) }))
    .filter(({ timestamp }) => Number.isFinite(timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  return {
    solvedCount: solvedQuestions.length,
    attemptCount,
    lastSolvedAt: latestCorrectTime?.value || "",
    questions,
  };
}

export function formatLevel(level) {
  if (level === null || level === undefined || level === "") {
    return "-";
  }

  const number = Number(level);
  if (!Number.isInteger(number) || number < 1) {
    return normalizeValue(level) || "-";
  }

  const code = `0x${number.toString(16).toUpperCase()}`;
  const title = LEVEL_TITLES[number];
  return title ? `${code} ${title}` : code;
}

export function findCurrentUserEntry(entries, user) {
  const currentTeam = entries.find((entry) => entry.isCurrentTeam);
  if (currentTeam) {
    return currentTeam;
  }

  if (!user) {
    return null;
  }

  return (
    entries.find((entry) => {
      const sameId = user.id && entry.id && user.id === entry.id;
      const sameUsername =
        user.username &&
        entry.username &&
        user.username.toLowerCase() === entry.username.toLowerCase();
      return sameId || sameUsername;
    }) || null
  );
}

export function entryKey(entry) {
  if (entry.id) {
    return `id:${entry.id}`;
  }
  if (entry.username) {
    return `username:${entry.username.toLowerCase()}`;
  }
  return "";
}

function replacePersonalizedRank(entries, index, normalized) {
  if (
    Number.isInteger(index) &&
    !entries[index].hasNumericRank &&
    normalized.hasNumericRank
  ) {
    entries[index] = normalized;
  }
}

export function firstString(...values) {
  return values.map(normalizeValue).find(Boolean) || "";
}

export function firstNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return 0;
}

export function firstOptionalNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") {
      continue;
    }

    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}

export function normalizeValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

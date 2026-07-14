export const DEFAULT_LIMIT = 100;
export const MAX_PAGES = 200;

export async function fetchFullLeaderboard({
  roomCode,
  limit = DEFAULT_LIMIT,
  maxPages = MAX_PAGES,
  fetchPage,
  onProgress = () => {},
}) {
  const entries = [];
  const seenKeys = new Set();

  for (let page = 1; page <= maxPages; page += 1) {
    onProgress({ page, entriesLoaded: entries.length });
    const data = await fetchPage({ roomCode, limit, page });
    const pageEntries = extractEntries(data);

    if (pageEntries.length === 0) {
      break;
    }

    let newEntries = 0;
    pageEntries.forEach((rawEntry, index) => {
      const normalized = normalizeEntry(rawEntry, entries.length + index + 1);
      const key = normalized.id || normalized.username || `${page}:${index}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        entries.push(normalized);
        newEntries += 1;
      }
    });

    if (pageEntries.length < limit || newEntries === 0) {
      break;
    }
  }

  return entries.sort((a, b) => a.rank - b.rank);
}

export function extractEntries(data) {
  if (Array.isArray(data)) {
    return data;
  }

  const candidates = [
    data?.data,
    data?.data?.scoreboard,
    data?.data?.leaderboard,
    data?.scoreboard,
    data?.leaderboard,
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
  const id = firstString(entry.userId, entry.id, entry._id, user.id, user._id);
  const rank = firstNumber(
    entry.rank,
    entry.position,
    entry.place,
    fallbackRank,
  );
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

  return {
    raw: entry,
    id,
    username: username || displayName || "Unknown user",
    displayName,
    rank,
    score,
    completedAt,
  };
}

export function findCurrentUserEntry(entries, user) {
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

export function normalizeValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

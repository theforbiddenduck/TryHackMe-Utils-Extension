import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LIMIT,
  extractEntries,
  fetchLeaderboardPages,
  fetchFullLeaderboard,
  findCurrentUserEntry,
  formatLevel,
  getScoreboardHttpErrorMessage,
  normalizeEntry,
  summarizeTasks,
} from "../src/leaderboard.js";

describe("getScoreboardHttpErrorMessage", () => {
  it("explains how to recover from TryHackMe's Vercel 429 check", () => {
    expect(getScoreboardHttpErrorMessage(429, 1)).toBe(
      "TryHackMe returned HTTP 429 for page 1. This is usually TryHackMe's Vercel security check. Refresh the TryHackMe room tab, then try again.",
    );
  });

  it("preserves the normal HTTP error for other statuses", () => {
    expect(getScoreboardHttpErrorMessage(500, 3)).toBe(
      "TryHackMe returned HTTP 500 for page 3.",
    );
  });
});

describe("extractEntries", () => {
  it("accepts the known scoreboard response shapes", () => {
    const rows = [{ username: "alice" }];

    expect(extractEntries(rows)).toBe(rows);
    expect(extractEntries({ data: rows })).toBe(rows);
    expect(extractEntries({ data: { docs: rows } })).toBe(rows);
    expect(extractEntries({ data: { scoreboard: rows } })).toBe(rows);
    expect(extractEntries({ data: { scoreboard: { docs: rows } } })).toBe(rows);
    expect(extractEntries({ data: { leaderboard: rows } })).toBe(rows);
    expect(extractEntries({ data: { leaderboard: { docs: rows } } })).toBe(
      rows,
    );
    expect(extractEntries({ data: { results: rows } })).toBe(rows);
    expect(extractEntries({ data: { users: rows } })).toBe(rows);
    expect(extractEntries({ data: { items: rows } })).toBe(rows);
    expect(extractEntries({ scoreboard: rows })).toBe(rows);
    expect(extractEntries({ scoreboard: { docs: rows } })).toBe(rows);
    expect(extractEntries({ leaderboard: rows })).toBe(rows);
    expect(extractEntries({ leaderboard: { docs: rows } })).toBe(rows);
    expect(extractEntries({ docs: rows })).toBe(rows);
    expect(extractEntries({ results: rows })).toBe(rows);
    expect(extractEntries({ users: rows })).toBe(rows);
    expect(extractEntries({ items: rows })).toBe(rows);
  });

  it("returns an empty array for unknown shapes", () => {
    expect(extractEntries({ data: { nope: [] } })).toEqual([]);
    expect(extractEntries(null)).toEqual([]);
  });
});

describe("normalizeEntry", () => {
  it("normalizes flat scoreboard rows", () => {
    expect(
      normalizeEntry(
        {
          userId: "u1",
          username: "alice",
          rank: "4",
          score: "9001",
          avatar: "/img/avatars/alice.png",
          level: "7",
          completedAt: "2026-06-29T10:00:00.000Z",
        },
        99,
      ),
    ).toMatchObject({
      id: "u1",
      username: "alice",
      rank: 4,
      score: 9001,
      avatar: "/img/avatars/alice.png",
      level: 7,
      completedAt: "2026-06-29T10:00:00.000Z",
    });
  });

  it("normalizes nested user rows and falls back to page order rank", () => {
    expect(
      normalizeEntry(
        {
          user: {
            _id: "u2",
            username: "bob",
          },
          points: 12,
        },
        7,
      ),
    ).toMatchObject({
      id: "u2",
      username: "bob",
      rank: 7,
      score: 12,
    });
  });

  it("normalizes the confirmed public scoreboard schema", () => {
    expect(
      normalizeEntry(
        {
          score: 45,
          timeScored: "2026-07-28T16:01:31.233Z",
          tasks: {
            1: [
              {
                questionNo: 1,
                correct: true,
                score: 45,
                attempts: 2,
                timeCorrect: "2026-07-28T18:18:52.916Z",
                answeredBy: {
                  username: "alice",
                },
              },
            ],
          },
          level: 10,
          avatar: "https://cdn-images.tryhackme.com/user-avatars/example.jpg",
          username: "MsRobot",
          userId: "u3",
          rank: 4,
        },
        99,
      ),
    ).toMatchObject({
      id: "u3",
      username: "MsRobot",
      avatar: "https://cdn-images.tryhackme.com/user-avatars/example.jpg",
      level: 10,
      rank: 4,
      score: 45,
      timeScored: "2026-07-28T16:01:31.233Z",
      solvedCount: 1,
      attemptCount: 2,
      lastSolvedAt: "2026-07-28T18:18:52.916Z",
      questions: [
        {
          taskNo: "1",
          questionNo: 1,
          correct: true,
          score: 45,
          attempts: 2,
          timeCorrect: "2026-07-28T18:18:52.916Z",
          answeredBy: "alice",
        },
      ],
    });
  });

  it("normalizes team leaderboard rows", () => {
    expect(
      normalizeEntry(
        {
          teamId: "team-1",
          isCurrentTeam: true,
          username: "Duck Squad",
          rank: 42,
          score: 180,
          timeScored: "2026-05-14T15:41:27.756Z",
        },
        99,
      ),
    ).toMatchObject({
      id: "team-1",
      username: "Duck Squad",
      isTeam: true,
      isCurrentTeam: true,
      rank: 42,
      score: 180,
      timeScored: "2026-05-14T15:41:27.756Z",
    });
  });

  it("derives a numeric rank from the row position for a personalized rank", () => {
    expect(
      normalizeEntry(
        {
          userId: "u1",
          username: "WellBehavedDuck",
          rank: "You",
        },
        17,
      ),
    ).toMatchObject({
      rank: 17,
      rankLabel: "#17",
      hasNumericRank: true,
    });
  });
});

describe("summarizeTasks", () => {
  it("summarizes solved questions, attempts, and the latest correct answer", () => {
    expect(
      summarizeTasks({
        1: [
          {
            questionNo: 1,
            correct: true,
            score: 15,
            attempts: 2,
            timeCorrect: "2026-07-28T18:18:52.916Z",
            answeredBy: { username: "alice" },
          },
          {
            questionNo: 2,
            correct: true,
            score: 30,
            attempts: 1,
            timeCorrect: "2026-07-29T02:13:45.887Z",
          },
        ],
        2: [{ questionNo: 1, correct: false, attempts: 3 }],
      }),
    ).toEqual({
      solvedCount: 2,
      attemptCount: 6,
      lastSolvedAt: "2026-07-29T02:13:45.887Z",
      questions: [
        {
          taskNo: "1",
          questionNo: 1,
          correct: true,
          score: 15,
          attempts: 2,
          timeCorrect: "2026-07-28T18:18:52.916Z",
          answeredBy: "alice",
        },
        {
          taskNo: "1",
          questionNo: 2,
          correct: true,
          score: 30,
          attempts: 1,
          timeCorrect: "2026-07-29T02:13:45.887Z",
          answeredBy: "",
        },
        {
          taskNo: "2",
          questionNo: 1,
          correct: false,
          score: 0,
          attempts: 3,
          timeCorrect: "",
          answeredBy: "",
        },
      ],
    });
  });

  it("returns an empty summary for missing task data", () => {
    expect(summarizeTasks(null)).toEqual({
      solvedCount: 0,
      attemptCount: 0,
      lastSolvedAt: "",
      questions: [],
    });
  });
});

describe("formatLevel", () => {
  it("formats confirmed TryHackMe levels with their code and title", () => {
    expect(formatLevel(7)).toBe("0x7 Adept");
    expect(formatLevel("14")).toBe("0xE Guardian");
    expect(formatLevel(21)).toBe("0x15 Grandmaster");
  });

  it("handles missing and future levels", () => {
    expect(formatLevel(null)).toBe("-");
    expect(formatLevel(22)).toBe("0x16");
  });
});

describe("findCurrentUserEntry", () => {
  const entries = [
    { id: "u1", username: "alice" },
    { id: "u2", username: "WellBehavedDuck" },
  ];

  it("matches by user id", () => {
    expect(
      findCurrentUserEntry(entries, { id: "u2", username: "someoneElse" }),
    ).toEqual(entries[1]);
  });

  it("matches username case-insensitively", () => {
    expect(
      findCurrentUserEntry(entries, { id: "", username: "wellbehavedduck" }),
    ).toEqual(entries[1]);
  });

  it("returns null without a matching user", () => {
    expect(
      findCurrentUserEntry(entries, { id: "u3", username: "charlie" }),
    ).toBeNull();
  });

  it("finds the current team without matching the signed-in username", () => {
    const teamEntries = [
      normalizeEntry(
        {
          teamId: "team-1",
          username: "Other Team",
          isCurrentTeam: false,
        },
        1,
      ),
      normalizeEntry(
        {
          teamId: "team-2",
          username: "Duck Squad",
          isCurrentTeam: true,
        },
        2,
      ),
    ];

    expect(
      findCurrentUserEntry(teamEntries, {
        id: "user-1",
        username: "WellBehavedDuck",
      }),
    ).toMatchObject({
      id: "team-2",
      username: "Duck Squad",
      isCurrentTeam: true,
    });
  });
});

describe("fetchFullLeaderboard", () => {
  it("fetches pages until a short page is returned", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { username: "a", rank: 1 },
          { username: "b", rank: 2 },
        ],
      })
      .mockResolvedValueOnce({ data: [{ username: "c", rank: 3 }] });

    const entries = await fetchFullLeaderboard({
      roomCode: "corridor",
      limit: 2,
      fetchPage,
    });

    expect(entries.map((entry) => entry.username)).toEqual(["a", "b", "c"]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenNthCalledWith(1, {
      roomCode: "corridor",
      limit: 2,
      page: 1,
    });
    expect(fetchPage).toHaveBeenNthCalledWith(2, {
      roomCode: "corridor",
      limit: 2,
      page: 2,
    });
  });

  it("deduplicates repeated rows and stops when a page adds no new users", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "u1", username: "a" }] })
      .mockResolvedValueOnce({ data: [{ id: "u1", username: "a" }] });

    const entries = await fetchFullLeaderboard({
      roomCode: "corridor",
      limit: 1,
      fetchPage,
    });

    expect(entries).toHaveLength(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("reports pagination progress", async () => {
    const onProgress = vi.fn();

    await fetchFullLeaderboard({
      roomCode: "corridor",
      limit: 100,
      fetchPage: vi.fn().mockResolvedValue({ data: [] }),
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith({ page: 1, entriesLoaded: 0 });
  });
});

describe("fetchLeaderboardPages", () => {
  it("uses a normal page size of 250", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ data: [] });

    await fetchLeaderboardPages({
      roomCode: "corridor",
      pagesToFetch: 1,
      fetchPage,
    });

    expect(DEFAULT_LIMIT).toBe(250);
    expect(fetchPage).toHaveBeenCalledWith({
      roomCode: "corridor",
      limit: 250,
      page: 1,
    });
  });

  it("stops after the page containing the current user", async () => {
    const firstPage = Array.from({ length: 2 }, (_, index) => ({
      id: `u${index + 1}`,
      username: `user${index + 1}`,
      rank: index + 1,
    }));
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({
        data: [
          { id: "u3", username: "current-user", rank: 3 },
          { id: "u4", username: "user4", rank: 4 },
        ],
      });

    const result = await fetchLeaderboardPages({
      roomCode: "corridor",
      user: { id: "u3", username: "current-user" },
      limit: 2,
      stopWhenUserFound: true,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.currentUserEntry).toMatchObject({
      id: "u3",
      rank: 3,
    });
    expect(result.nextPage).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(result.repeatedPage).toBe(false);
  });

  it("stops on a personalized 'You' rank and derives its numeric row position", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce({
      data: [
        { userId: "u1", username: "user1", rank: 1 },
        {
          userId: "current",
          username: "WellBehavedDuck",
          rank: "You",
        },
      ],
    });

    const result = await fetchLeaderboardPages({
      roomCode: "corridor",
      user: { id: "current", username: "WellBehavedDuck" },
      limit: 2,
      stopWhenUserFound: true,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.currentUserEntry).toMatchObject({
      rank: 2,
      rankLabel: "#2",
      hasNumericRank: true,
    });
    expect(result.nextPage).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it("continues to the end when the current user is absent", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { id: "u1", username: "user1" },
          { id: "u2", username: "user2" },
        ],
      })
      .mockResolvedValueOnce({
        data: [{ id: "u3", username: "user3" }],
      });

    const result = await fetchLeaderboardPages({
      roomCode: "corridor",
      user: { id: "missing", username: "missing" },
      limit: 2,
      stopWhenUserFound: true,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(result.entries).toHaveLength(3);
    expect(result.currentUserEntry).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it("appends one page for Load more and preserves prior entries", async () => {
    const existingEntries = [
      normalizeEntry({ id: "u1", username: "user1", rank: 1 }, 1),
      normalizeEntry({ id: "u2", username: "user2", rank: 2 }, 2),
    ];
    const fetchPage = vi.fn().mockResolvedValue({
      data: [
        { id: "u3", username: "user3", rank: 3 },
        { id: "u4", username: "user4", rank: 4 },
      ],
    });

    const result = await fetchLeaderboardPages({
      roomCode: "corridor",
      startPage: 2,
      existingEntries,
      limit: 2,
      pagesToFetch: 1,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.entries.map((entry) => entry.username)).toEqual([
      "user1",
      "user2",
      "user3",
      "user4",
    ]);
    expect(result.nextPage).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(result.repeatedPage).toBe(false);
  });

  it("stops when TryHackMe ignores page and repeats the same results", async () => {
    const repeatedEntries = [
      { id: "u1", username: "user1", rank: 1 },
      { id: "u2", username: "user2", rank: 2 },
    ];
    const fetchPage = vi.fn().mockResolvedValue({ data: repeatedEntries });

    const result = await fetchLeaderboardPages({
      roomCode: "event-room",
      user: { id: "missing", username: "missing" },
      limit: 2,
      stopWhenUserFound: true,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenLastCalledWith({
      roomCode: "event-room",
      limit: 2,
      page: 2,
    });
    expect(result.entries).toHaveLength(2);
    expect(result.hasMore).toBe(false);
    expect(result.repeatedPage).toBe(true);
  });

  it("retries a non-paginating room with the maximum limit", async () => {
    const firstPage = Array.from({ length: 250 }, (_, index) => ({
      id: `u${index + 1}`,
      username: `user${index + 1}`,
      rank: index + 1,
    }));
    const expandedPage = Array.from({ length: 500 }, (_, index) => ({
      id: `u${index + 1}`,
      username: index === 259 ? "current-user" : `user${index + 1}`,
      rank: index + 1,
    }));
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: firstPage })
      .mockResolvedValueOnce({ data: expandedPage });

    const result = await fetchLeaderboardPages({
      roomCode: "event-room",
      user: { id: "u260", username: "current-user" },
      stopWhenUserFound: true,
      fetchPage,
    });

    expect(fetchPage).toHaveBeenLastCalledWith({
      roomCode: "event-room",
      limit: 500,
      page: 1,
    });
    expect(result.entries).toHaveLength(500);
    expect(result.currentUserEntry).toMatchObject({
      rank: 260,
      username: "current-user",
    });
    expect(result.hasMore).toBe(false);
    expect(result.repeatedPage).toBe(true);
  });
});

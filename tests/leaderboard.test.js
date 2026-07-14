import { describe, expect, it, vi } from "vitest";
import {
  extractEntries,
  fetchFullLeaderboard,
  findCurrentUserEntry,
  normalizeEntry,
} from "../src/leaderboard.js";

describe("extractEntries", () => {
  it("accepts the known scoreboard response shapes", () => {
    const rows = [{ username: "alice" }];

    expect(extractEntries(rows)).toBe(rows);
    expect(extractEntries({ data: rows })).toBe(rows);
    expect(extractEntries({ data: { scoreboard: rows } })).toBe(rows);
    expect(extractEntries({ data: { leaderboard: rows } })).toBe(rows);
    expect(extractEntries({ scoreboard: rows })).toBe(rows);
    expect(extractEntries({ leaderboard: rows })).toBe(rows);
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
          completedAt: "2026-06-29T10:00:00.000Z",
        },
        99,
      ),
    ).toMatchObject({
      id: "u1",
      username: "alice",
      rank: 4,
      score: 9001,
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

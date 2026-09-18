import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("notifications.js — push Pusher + fallback", () => {
  let mockChannel;
  let mockPusherInstance;
  let stateChangeCallback;
  let mockApi;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<span id="navFriendsBadge" class="hidden"></span>';

    globalThis.window._currentUser = { id: 42 };
    mockApi = {
      notifications: { get: vi.fn().mockResolvedValue({ friend_requests: 0 }) },
      friends: { list: vi.fn().mockResolvedValue({ pending_requests: [] }) },
      messages: { list: vi.fn().mockResolvedValue({ messages: [] }) },
      socialLink: { getRankUpNotifs: vi.fn().mockResolvedValue({ notifs: [] }) },
    };
    globalThis.window._personadleApi = mockApi;
    globalThis.window._pusherKey = "test-key";
    globalThis.window._pusherCluster = "eu";

    mockChannel = { bind: vi.fn() };
    mockPusherInstance = {
      subscribe: vi.fn().mockReturnValue(mockChannel),
      disconnect: vi.fn(),
      connection: {
        bind: vi.fn((event, cb) => {
          if (event === "state_change") stateChangeCallback = cb;
        }),
        state: "connected",
      },
    };

    globalThis.window.Pusher = vi.fn(function PusherMock() {
      return mockPusherInstance;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.window._currentUser;
    delete globalThis.window._personadleApi;
    delete globalThis.window._pusherKey;
    delete globalThis.window._pusherCluster;
    delete globalThis.window.Pusher;
    vi.resetModules();
  });

  /**
   * Importe notifications.js puis réaffiche le mock API sur window —
   * l'import charge js/api.js (pour getCsrfToken/BASE_URL), dont l'effet de
   * bord `window._personadleApi = api;` écraserait sinon notre mock.
   */
  async function importNotifications() {
    const mod = await import("../js/notifications.js");
    globalThis.window._personadleApi = mockApi;
    return mod;
  }

  it("subscribes to the user's private channel with CSRF auth header", async () => {
    const { initNotifications } = await importNotifications();
    await initNotifications();

    expect(window.Pusher).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({
        authEndpoint: expect.stringContaining("/pusher/auth"),
        auth: expect.objectContaining({ headers: expect.any(Object) }),
      })
    );
    expect(mockPusherInstance.subscribe).toHaveBeenCalledWith("private-user-42");
  });

  it("re-runs the HTTP check immediately when a challenge event is received", async () => {
    const { initNotifications } = await importNotifications();
    await initNotifications();

    mockApi.notifications.get.mockClear();

    const boundEvents = Object.fromEntries(
      mockChannel.bind.mock.calls.map(([event, cb]) => [event, cb])
    );
    boundEvents["challenge"]();
    await vi.runAllTimersAsync();

    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to polling when the Pusher connection is not connected", async () => {
    const { initNotifications } = await importNotifications();
    await initNotifications();

    mockApi.notifications.get.mockClear();
    mockPusherInstance.connection.state = "disconnected";
    stateChangeCallback({ current: "disconnected" });

    await vi.advanceTimersByTimeAsync(5 * 60_000 + 10_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
  });

  // ── Pusher NON configuré (prod sans clés posées, dev local sans .env) ──────
  // C’est l’état dans lequel la prod sera au déploiement de ce lot : il doit se
  // comporter EXACTEMENT comme avant (polling 60 s), sans toucher au CDN.

  it("without a Pusher key: never loads pusher-js nor instantiates Pusher", async () => {
    delete window._pusherKey;
    delete window._pusherCluster;
    const appendSpy = vi.spyOn(document.head, "appendChild");

    const { initNotifications } = await importNotifications();
    await initNotifications();

    expect(window.Pusher).not.toHaveBeenCalled();
    const scriptTags = appendSpy.mock.calls.filter(([node]) => node?.tagName === "SCRIPT");
    expect(scriptTags).toHaveLength(0);
  });

  it("without a Pusher key: keeps the historical 60s polling (no latency regression)", async () => {
    delete window._pusherKey;
    delete window._pusherCluster;

    const { initNotifications } = await importNotifications();
    await initNotifications();
    mockApi.notifications.get.mockClear();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(2);
  });

  it("with a null key from /me (config.php without PUSHER_*): still polls, does not throw", async () => {
    window._pusherKey = null;
    window._pusherCluster = null;

    const { initNotifications } = await importNotifications();
    await expect(initNotifications()).resolves.toBeUndefined();
    mockApi.notifications.get.mockClear();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
  });

  it("with a key but no cluster: treated as unconfigured (60s polling)", async () => {
    window._pusherCluster = "";

    const { initNotifications } = await importNotifications();
    await initNotifications();
    mockApi.notifications.get.mockClear();

    expect(window.Pusher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
  });

  // ── Pusher configuré mais cassé ───────────────────────────────────────────

  it("falls back to 5min polling when the Pusher constructor throws", async () => {
    window.Pusher = vi.fn(function PusherMock() {
      throw new Error("You must pass your app key when you instantiate Pusher.");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { initNotifications } = await importNotifications();
    await expect(initNotifications()).resolves.toBeUndefined();
    mockApi.notifications.get.mockClear();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockApi.notifications.get).not.toHaveBeenCalled(); // pas de 60 s ici : Pusher est configuré
    await vi.advanceTimersByTimeAsync(4 * 60_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to 5min polling when pusher-js fails to load from the CDN", async () => {
    delete window.Pusher;
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node?.tagName === "SCRIPT") queueMicrotask(() => node.onerror?.(new Event("error")));
      return node;
    });

    const { initNotifications } = await importNotifications();
    await initNotifications();
    mockApi.notifications.get.mockClear();

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
  });

  it("falls back to 5min polling when pusher-js load times out (8s)", async () => {
    delete window.Pusher;
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => node); // ni onload ni onerror

    const { initNotifications } = await importNotifications();
    const p = initNotifications();
    await vi.advanceTimersByTimeAsync(8_000);
    await p;
    mockApi.notifications.get.mockClear();

    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(mockApi.notifications.get).toHaveBeenCalledTimes(1);
  });

  it("stops the fallback polling once Pusher reconnects", async () => {
    const { initNotifications } = await importNotifications();
    await initNotifications();

    mockPusherInstance.connection.state = "unavailable";
    stateChangeCallback({ current: "unavailable" });
    await vi.advanceTimersByTimeAsync(10_000); // grâce écoulée → fallback armé

    mockPusherInstance.connection.state = "connected";
    stateChangeCallback({ current: "connected" });
    mockApi.notifications.get.mockClear();

    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(mockApi.notifications.get).not.toHaveBeenCalled();
  });

  it("a short disconnection (< grace) never arms the fallback polling", async () => {
    const { initNotifications } = await importNotifications();
    await initNotifications();

    mockPusherInstance.connection.state = "connecting";
    stateChangeCallback({ current: "connecting" });
    await vi.advanceTimersByTimeAsync(3_000);
    mockPusherInstance.connection.state = "connected";
    stateChangeCallback({ current: "connected" });
    mockApi.notifications.get.mockClear();

    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(mockApi.notifications.get).not.toHaveBeenCalled();
  });

  it("binds all five server-side event names to a re-check", async () => {
    const { initNotifications } = await importNotifications();
    await initNotifications();

    const bound = mockChannel.bind.mock.calls.map(([evt]) => evt).sort();
    expect(bound).toEqual(["challenge", "challenge_beaten", "friend_declined", "friend_request", "rankup"]);
  });

  it("stopNotifications disconnects Pusher and clears the fallback timer", async () => {
    const { initNotifications, stopNotifications } = await importNotifications();
    await initNotifications();

    stopNotifications();

    expect(mockPusherInstance.disconnect).toHaveBeenCalled();

    mockApi.notifications.get.mockClear();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(mockApi.notifications.get).not.toHaveBeenCalled();
  });
});

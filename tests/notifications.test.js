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

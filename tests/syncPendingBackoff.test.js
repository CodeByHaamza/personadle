import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api } from "../js/api.js";

/**
 * syncPendingBackoff.test.js — La file de sessions ne s'auto-entretient plus.
 *
 * Bug de production du 2026-09-02, vu dans la console d'un joueur : des dizaines
 * de `429 Too many session submissions` à la suite, puis des `503`.
 *
 * `syncPending()` remettait en file toute erreur non-409/400 **et continuait la
 * boucle**. Sur un 429, l'élément suivant repartait donc immédiatement, en
 * re-déclenchant un 429, et ainsi de suite jusqu'au bout de la file — puis tout
 * était réécrit en file et rejoué au chargement suivant. Une file un peu grosse
 * suffisait à s'y enfermer : la console noyée, et **aucune** session ne passait.
 *
 * Un 429 veut dire « arrête », pas « essaie le suivant ».
 */

/** Remplit la file locale avec `n` sessions distinctes. */
function queue(n) {
  const items = Array.from({ length: n }, (_, i) => ({
    mode: "music",
    target_name: `T${i}`,
    result: "win",
    attempts: 1,
    time_ms: 1000,
    client_session_id: `cid-${i}`,
  }));
  localStorage.setItem("pendingSessions", JSON.stringify(items));
  return items;
}

const readQueue = () => JSON.parse(localStorage.getItem("pendingSessions") || "[]");

/** Réponse fetch minimale. */
const reply = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  localStorage.clear();
  api.stats._syncLock = false;
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
  api.stats._syncLock = false;
});

describe("syncPending — arrêt sur 429 / 5xx", () => {
  it("s'arrête au premier 429 au lieu de vider la file en la rejouant", async () => {
    queue(5);
    // 1ʳᵉ passe, puis limitation.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply(201))
      .mockResolvedValue(reply(429, { message: "Too many session submissions." }));
    vi.stubGlobal("fetch", fetchMock);

    await api.stats.syncPending();

    // 2 appels seulement : le succès, puis le 429 qui interrompt.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Les 4 non-envoyées sont conservées telles quelles, sans avoir été tentées.
    expect(readQueue().map((s) => s.client_session_id)).toEqual([
      "cid-1",
      "cid-2",
      "cid-3",
      "cid-4",
    ]);
  });

  it("s'arrête aussi sur une erreur serveur (503)", async () => {
    queue(4);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(503, { message: "Database unavailable" })));

    await api.stats.syncPending();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readQueue()).toHaveLength(4);
  });

  it("vide la file quand tout passe", async () => {
    queue(3);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(201)));

    await api.stats.syncPending();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(readQueue()).toEqual([]);
  });

  it("écarte définitivement un 409 et un 400 sans interrompre la file", async () => {
    // 409 = déjà enregistrée côté serveur, 400 = donnée invalide : les rejouer
    // indéfiniment ne servirait à rien. Ce sont les SEULS cas où l'on jette.
    queue(3);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply(409))
        .mockResolvedValueOnce(reply(400))
        .mockResolvedValueOnce(reply(201))
    );

    await api.stats.syncPending();

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(readQueue()).toEqual([]);
  });
});

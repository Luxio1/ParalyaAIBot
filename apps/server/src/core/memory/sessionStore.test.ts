import { describe, expect, it } from 'vitest';
import { SessionStore, type SessionInfo } from './sessionStore';

const MINUTE = 60_000;
const ALICE: SessionInfo = { id: 'dm:1', kind: 'dm', userName: 'Alice', channelName: null };

function storeWithClock() {
  let now = 0;
  const store = new SessionStore(() => now);
  return { store, advance: (ms: number) => (now += ms) };
}

describe('SessionStore', () => {
  it('garde les derniers messages en commençant par une question', () => {
    const { store } = storeWithClock();
    for (let i = 1; i <= 3; i++) {
      store.append(
        ALICE,
        [
          { role: 'user', text: `question ${i}` },
          { role: 'model', text: `réponse ${i}` },
        ],
        5,
      );
    }
    expect(store.history(ALICE.id, 30 * MINUTE).map((turn) => turn.text)).toEqual([
      'question 2',
      'réponse 2',
      'question 3',
      'réponse 3',
    ]);
  });

  it('oublie une conversation inactive au-delà de la rétention', () => {
    const { store, advance } = storeWithClock();
    let changes = 0;
    store.subscribe(() => changes++);
    store.append(ALICE, [{ role: 'user', text: 'bonjour' }], 10);

    advance(29 * MINUTE);
    expect(store.list(30 * MINUTE)).toMatchObject([
      { id: 'dm:1', messageCount: 1, expiresAt: new Date(30 * MINUTE).toISOString() },
    ]);
    advance(MINUTE);
    expect(store.history(ALICE.id, 30 * MINUTE)).toEqual([]);
    expect(changes).toBe(2);
  });

  it('efface une conversation ou toutes', () => {
    const { store } = storeWithClock();
    store.append(ALICE, [{ role: 'user', text: 'a' }], 10);
    store.append({ ...ALICE, id: 'dm:2', userName: 'Bob' }, [{ role: 'user', text: 'b' }], 10);

    expect(store.remove('dm:1')).toBe(true);
    expect(store.remove('dm:1')).toBe(false);
    expect(store.list(MINUTE).map((session) => session.userName)).toEqual(['Bob']);
    store.clear();
    expect(store.list(MINUTE)).toEqual([]);
  });
});

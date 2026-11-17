import type { Client } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { formatBotReply, formatIncomingDm, sendToRelay } from './dmRelay';

const ALICE = { id: '200000000000000001', username: 'alice', displayName: 'Alice' };

/** Salon Discord factice : seule la méthode `send` et ses contrôles de type sont utilisés. */
function fakeClient(sent: unknown[]): Client {
  const channel = {
    isDMBased: () => false,
    isSendable: () => true,
    send: async (options: unknown) => void sent.push(options),
  };
  return { channels: { fetch: async () => channel } } as unknown as Client;
}

describe('retranscription des MP', () => {
  it('met en forme le MP reçu et la réponse du bot en citations', () => {
    const incoming = formatIncomingDm(ALICE, 'Bonjour\nça va ?', [
      { name: 'photo.png', url: 'https://cdn.discordapp.com/photo.png' },
    ]);
    expect(incoming).toBe(
      [
        '📩 **MP reçu de Alice** (@alice, `200000000000000001`) :',
        '> Bonjour',
        '> ça va ?',
        '📎 [photo.png](<https://cdn.discordapp.com/photo.png>)',
      ].join('\n'),
    );
    expect(formatBotReply(ALICE, 'Oui !')).toBe(
      '🤖 **Réponse du bot à Alice** (@alice) :\n> Oui !',
    );
  });

  it('ne notifie personne, même si le MP contient @everyone', async () => {
    const sent: unknown[] = [];
    await sendToRelay(
      fakeClient(sent),
      '100000000000000001',
      formatIncomingDm(ALICE, '@everyone', []),
    );
    expect(sent).toEqual([expect.objectContaining({ allowedMentions: { parse: [] } })]);
  });
});

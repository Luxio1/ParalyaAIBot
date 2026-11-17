import { describe, expect, it } from 'vitest';
import { checkUrl, isPublicAddress, safeFetch } from './safeFetch';

const ANY = { accept: '*/*', maxBytes: () => 1024 };

describe('safeFetch', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::a00:1',
    'fd00::1',
    'fe80::1',
    'pas-une-ip',
  ])('considère %s comme non publique', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['1.1.1.1', '142.250.74.110', '2606:4700:4700::1111'])(
    'considère %s comme publique',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it.each([
    ['ftp://example.com/fichier', /protocole ftp: refusé/],
    ['file:///etc/passwd', /protocole file: refusé/],
    ['http://example.com:8080/', /port 8080 refusé/],
    ['http://admin:secret@example.com/', /identifiants/],
    ['http://127.0.0.1/', /non publique/],
    ['http://[::1]/', /non publique/],
    ['http://169.254.169.254/latest/meta-data/', /non publique/],
    ['pas une url', /adresse invalide/],
  ])('refuse %s avant toute connexion', (url, reason) => {
    expect(() => checkUrl(url)).toThrow(reason);
  });

  it('refuse un nom de domaine qui pointe vers la machine elle-même', async () => {
    await expect(safeFetch('http://localhost/', ANY)).rejects.toThrow(/non publique/);
  });
});

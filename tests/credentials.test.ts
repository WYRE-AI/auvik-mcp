import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCredentials, credentialsStorage } from '../src/credentials.js';

describe('getCredentials', () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.AUVIK_USERNAME;
    delete process.env.AUVIK_API_KEY;
    delete process.env.AUVIK_REGION;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it('returns null when no creds are set', () => {
    expect(getCredentials()).toBeNull();
  });

  it('reads creds from env vars in single-tenant mode', () => {
    process.env.AUVIK_USERNAME = 'user@example.com';
    process.env.AUVIK_API_KEY = 'secret';
    process.env.AUVIK_REGION = 'us1';
    expect(getCredentials()).toEqual({
      username: 'user@example.com',
      apiKey: 'secret',
      region: 'us1',
    });
  });

  it('prefers AsyncLocalStorage over env vars', () => {
    process.env.AUVIK_USERNAME = 'env-user';
    process.env.AUVIK_API_KEY = 'env-key';
    credentialsStorage.run(
      { username: 'als-user', apiKey: 'als-key', region: 'eu1' },
      () => {
        expect(getCredentials()).toEqual({
          username: 'als-user',
          apiKey: 'als-key',
          region: 'eu1',
        });
      },
    );
  });
});

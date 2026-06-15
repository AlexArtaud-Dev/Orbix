import { OrbixException } from './orbix-exception';

export class VaultAuthUnsupportedTypeException extends OrbixException {
  constructor(subtype: string) {
    super(
      'VAULT_AUTH_UNSUPPORTED_TYPE',
      `HTTP auth type '${subtype}' is not supported`,
      undefined,
      { subtype },
    );
  }
}

export class VaultOAuth2TokenFailedException extends OrbixException {
  constructor(status: number, tokenUrl: string) {
    super(
      'VAULT_OAUTH2_TOKEN_FAILED',
      `OAuth2 token request failed: HTTP ${status}`,
      `Token URL: ${tokenUrl}`,
      { status, tokenUrl },
    );
  }
}

export class VaultOAuth2MissingTokenException extends OrbixException {
  constructor(tokenUrl: string) {
    super(
      'VAULT_OAUTH2_MISSING_TOKEN',
      'OAuth2 response missing access_token',
      `Token URL: ${tokenUrl}`,
      { tokenUrl },
    );
  }
}

export class VaultSmtpTestFailedException extends OrbixException {
  constructor(name: string, cause: string) {
    super('VAULT_SMTP_TEST_FAILED', `SMTP test failed for '${name}'`, cause, {
      name,
    });
  }
}

export class VaultDecryptionFailedException extends OrbixException {
  constructor() {
    super(
      'VAULT_DECRYPTION_FAILED',
      'Failed to decrypt vault payload — stored data may be corrupted or the encryption key changed',
    );
  }
}

export class VaultSshTestFailedException extends OrbixException {
  constructor(steps: { connection: string; path: string; write: string }) {
    super(
      'VAULT_SSH_TEST_FAILED',
      'SSH connection test failed',
      JSON.stringify(steps),
      { steps },
    );
  }
}

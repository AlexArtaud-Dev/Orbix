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

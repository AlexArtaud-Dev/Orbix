export type OrbixErrorCode =
  // ── Generic fallbacks ──────────────────────────────────────────────────────
  | 'BACKUP_RUN_ERROR'
  | 'BACKUP_VALIDATE_ERROR'
  // ── Input ──────────────────────────────────────────────────────────────────
  | 'INPUT_PROVIDER_NOT_FOUND'
  | 'INPUT_FETCH_HTTP_ERROR'
  | 'INPUT_FETCH_SIZE_EXCEEDED'
  | 'INPUT_FETCH_INVALID_RESPONSE'
  // ── URL source ─────────────────────────────────────────────────────────────
  | 'URL_SOURCE_HTTP_ERROR'
  | 'URL_SOURCE_SIZE_EXCEEDED'
  | 'URL_SOURCE_NO_BODY'
  // ── Archive ────────────────────────────────────────────────────────────────
  | 'ARCHIVE_SIZE_EXCEEDED'
  | 'ARCHIVE_NO_ARCHIVE_MULTI_FILE'
  | 'ARCHIVE_NO_ARCHIVE_STREAM'
  // ── Output ─────────────────────────────────────────────────────────────────
  | 'OUTPUT_PROVIDER_NOT_FOUND'
  | 'MAIL_SEND_FAILED'
  // ── Vault / Auth ───────────────────────────────────────────────────────────
  | 'VAULT_AUTH_UNSUPPORTED_TYPE'
  | 'VAULT_OAUTH2_TOKEN_FAILED'
  | 'VAULT_OAUTH2_MISSING_TOKEN';

export class OrbixException extends Error {
  constructor(
    public readonly code: OrbixErrorCode,
    message: string,
    public readonly detail?: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

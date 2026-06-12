import { OrbixException } from './orbix-exception';

export class OutputProviderNotFoundException extends OrbixException {
  constructor(type: string) {
    super(
      'OUTPUT_PROVIDER_NOT_FOUND',
      `No output provider registered for type '${type}'`,
      `Register a provider for '${type}' in ProvidersModule`,
      { type },
    );
  }
}

export class MailSendFailedException extends OrbixException {
  constructor(to: string, cause: string) {
    super('MAIL_SEND_FAILED', `Mail send failed to '${to}'`, cause, { to });
  }
}

export class MailAttachmentTooLargeException extends OrbixException {
  constructor(sizeMb: number, limitMb: number) {
    super(
      'MAIL_ATTACHMENT_TOO_LARGE',
      `Archive size (${sizeMb.toFixed(1)} MB) exceeds the configured mail attachment limit of ${limitMb} MB`,
      `Increase the limit in Settings → Mail, or reduce the backup scope.`,
      { sizeMb, limitMb },
    );
  }
}

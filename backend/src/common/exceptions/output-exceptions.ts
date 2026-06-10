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

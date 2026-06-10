import { OrbixException } from './orbix-exception';

export class InputProviderNotFoundException extends OrbixException {
  constructor(type: string) {
    super(
      'INPUT_PROVIDER_NOT_FOUND',
      `No input provider registered for type '${type}'`,
      `Register a provider for '${type}' in ProvidersModule`,
      { type },
    );
  }
}

export class InputFetchHttpException extends OrbixException {
  constructor(url: string, status: number, label = 'Input source') {
    super(
      'INPUT_FETCH_HTTP_ERROR',
      `${label} returned HTTP ${status}: ${url}`,
      undefined,
      { url, status },
    );
  }
}

export class InputFetchSizeExceededException extends OrbixException {
  constructor(itemName: string, sizeMb: number, limitMb: number) {
    super(
      'INPUT_FETCH_SIZE_EXCEEDED',
      `Input item '${itemName}' (${sizeMb} MB) exceeds limit of ${limitMb} MB`,
      undefined,
      { itemName, sizeMb, limitMb },
    );
  }
}

export class InputFetchInvalidResponseException extends OrbixException {
  constructor(message: string, context?: Record<string, unknown>) {
    super('INPUT_FETCH_INVALID_RESPONSE', message, undefined, context);
  }
}

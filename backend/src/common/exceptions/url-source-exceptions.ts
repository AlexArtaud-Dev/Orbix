import { OrbixException } from './orbix-exception';

export class UrlSourceHttpException extends OrbixException {
  constructor(url: string, status: number) {
    super(
      'URL_SOURCE_HTTP_ERROR',
      `URL source returned HTTP ${status}: ${url}`,
      undefined,
      { url, status },
    );
  }
}

export class UrlSourceSizeExceededException extends OrbixException {
  constructor(sizeMb: number, limitMb: number, url: string) {
    super(
      'URL_SOURCE_SIZE_EXCEEDED',
      `Source file size (${sizeMb} MB) exceeds the configured limit of ${limitMb} MB`,
      `URL: ${url}`,
      { sizeMb, limitMb, url },
    );
  }
}

export class UrlSourceNoBodyException extends OrbixException {
  constructor(url: string) {
    super(
      'URL_SOURCE_NO_BODY',
      `URL source returned no body: ${url}`,
      undefined,
      {
        url,
      },
    );
  }
}

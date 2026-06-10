import { OrbixException } from './orbix-exception';

export class ArchiveSizeExceededException extends OrbixException {
  constructor(sizeMb: number, limitMb: number) {
    super(
      'ARCHIVE_SIZE_EXCEEDED',
      `Archive size (${sizeMb} MB) exceeds the configured limit of ${limitMb} MB`,
      undefined,
      { sizeMb, limitMb },
    );
  }
}

export class ArchiveNoArchiveMultiFileException extends OrbixException {
  constructor(filesCount: number) {
    super(
      'ARCHIVE_NO_ARCHIVE_MULTI_FILE',
      `noArchive mode requires exactly 1 file, but ${filesCount} were collected`,
      undefined,
      { filesCount },
    );
  }
}

export class ArchiveNoArchiveStreamException extends OrbixException {
  constructor() {
    super(
      'ARCHIVE_NO_ARCHIVE_STREAM',
      'noArchive mode does not support streamed sources — use a file or input that buffers',
    );
  }
}

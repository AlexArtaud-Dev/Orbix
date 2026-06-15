export interface SshInputSource {
  /** Absolute remote path (file or directory) */
  path: string;
  isDirectory: boolean;
  /** Recurse into sub-directories — only relevant when isDirectory is true */
  recursive: boolean;
  /**
   * Regex applied to each filename.
   * Supports date tokens replaced at fetch time: {YYYY} {MM} {DD} {HH}
   */
  namePattern?: string;
}

export interface SshInputConfig {
  sources: SshInputSource[];
}

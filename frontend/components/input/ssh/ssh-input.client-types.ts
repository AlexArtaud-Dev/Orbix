export interface SshInputSource {
  path: string;
  isDirectory: boolean;
  recursive: boolean;
  namePattern?: string;
}

export interface SshInputConfig {
  sources: SshInputSource[];
}

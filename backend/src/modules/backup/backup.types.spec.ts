import { parseBackupSources, parseScheduleConfig } from './backup.types';

describe('parseBackupSources', () => {
  it('returns empty sources for null', () => {
    expect(parseBackupSources(null)).toEqual({ sources: [] });
  });

  it('returns empty sources for a string', () => {
    expect(parseBackupSources('not-an-object')).toEqual({ sources: [] });
  });

  it('returns empty sources for an array', () => {
    expect(parseBackupSources([])).toEqual({ sources: [] });
  });

  it('returns empty sources for an empty object', () => {
    expect(parseBackupSources({})).toEqual({ sources: [] });
  });

  it('parses standard { sources } format with folder type', () => {
    const input = {
      sources: [{ path: '/data', type: 'folder', exclude: ['*.tmp'] }],
    };
    const result = parseBackupSources(input);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]).toEqual({ path: '/data', type: 'folder', exclude: ['*.tmp'] });
  });

  it('parses standard { sources } format with file type', () => {
    const input = {
      sources: [{ path: '/etc/config.yaml', type: 'file', exclude: [] }],
    };
    const result = parseBackupSources(input);
    expect(result.sources[0].type).toBe('file');
  });

  it('defaults type to folder for unknown type values', () => {
    const result = parseBackupSources({ sources: [{ path: '/x', type: 'unknown' }] });
    expect(result.sources[0].type).toBe('folder');
  });

  it('defaults exclude to empty array when not provided', () => {
    const result = parseBackupSources({ sources: [{ path: '/x', type: 'folder' }] });
    expect(result.sources[0].exclude).toEqual([]);
  });

  it('skips sources with an empty path', () => {
    const input = {
      sources: [
        { path: '', type: 'folder' },
        { path: '/valid', type: 'folder' },
      ],
    };
    const result = parseBackupSources(input);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].path).toBe('/valid');
  });

  it('skips non-object entries in sources array', () => {
    const input = { sources: ['not-an-object', null, { path: '/ok', type: 'folder' }] };
    const result = parseBackupSources(input);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].path).toBe('/ok');
  });

  it('parses multiple sources', () => {
    const input = {
      sources: [
        { path: '/home/docs', type: 'folder', exclude: ['*.bak'] },
        { path: '/etc/app.conf', type: 'file' },
      ],
    };
    const result = parseBackupSources(input);
    expect(result.sources).toHaveLength(2);
  });

  it('parses legacy { paths, exclude } format', () => {
    const input = { paths: ['/a', '/b'], exclude: ['*.log'] };
    const result = parseBackupSources(input);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0]).toEqual({ path: '/a', type: 'folder', exclude: ['*.log'] });
    expect(result.sources[1]).toEqual({ path: '/b', type: 'folder', exclude: ['*.log'] });
  });

  it('parses legacy format with no exclude field', () => {
    const input = { paths: ['/x'] };
    const result = parseBackupSources(input);
    expect(result.sources[0].exclude).toEqual([]);
  });

  it('returns empty for legacy format with no paths', () => {
    expect(parseBackupSources({ exclude: ['*.log'] })).toEqual({ sources: [] });
  });
});

describe('parseScheduleConfig', () => {
  it('returns null for null', () => {
    expect(parseScheduleConfig(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseScheduleConfig(undefined)).toBeNull();
  });

  it('returns null for an array', () => {
    expect(parseScheduleConfig([])).toBeNull();
  });

  it('returns null for a primitive string', () => {
    expect(parseScheduleConfig('some-string')).toBeNull();
  });

  it('returns null for a number', () => {
    expect(parseScheduleConfig(42)).toBeNull();
  });

  it('returns the config object as-is for a valid object', () => {
    const config = { days: [1, 2, 3], hour: 8, minute: 30, timezone: 'UTC' };
    expect(parseScheduleConfig(config)).toEqual(config);
  });

  it('returns empty object without modification', () => {
    expect(parseScheduleConfig({})).toEqual({});
  });
});

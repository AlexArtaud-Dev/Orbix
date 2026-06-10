import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateBackupDto } from './create-backup.dto';

async function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateBackupDto, plain);
  return validate(dto, { whitelist: true });
}

function constraintNames(errors: Awaited<ReturnType<typeof validateDto>>) {
  return errors.flatMap((e) => Object.keys(e.constraints ?? {}));
}

describe('CreateBackupDto', () => {
  const base = { name: 'My Backup' };

  it('passes with only a name', async () => {
    const errors = await validateDto(base);
    expect(errors).toHaveLength(0);
  });

  it('fails when name is missing', async () => {
    const errors = await validateDto({});
    expect(constraintNames(errors)).toEqual(
      expect.arrayContaining(['isNotEmpty']),
    );
  });

  it('fails when name is empty string', async () => {
    const errors = await validateDto({ name: '' });
    expect(constraintNames(errors)).toEqual(
      expect.arrayContaining(['isNotEmpty']),
    );
  });

  it('fails when scheduleType is not an accepted value', async () => {
    const errors = await validateDto({ ...base, scheduleType: 'daily' });
    expect(constraintNames(errors)).toEqual(expect.arrayContaining(['isIn']));
  });

  it('passes with valid scheduleType values', async () => {
    for (const t of ['manual', 'oneshoot', 'recurring', 'interval']) {
      const errors = await validateDto({ ...base, scheduleType: t });
      expect(errors).toHaveLength(0);
    }
  });

  it('fails when archiveFormat is not an accepted value', async () => {
    const errors = await validateDto({ ...base, archiveFormat: '7z' });
    expect(constraintNames(errors)).toEqual(expect.arrayContaining(['isIn']));
  });

  it('passes with valid archiveFormat values', async () => {
    for (const fmt of ['zip', 'tar', 'tar-gz', 'tar-bz2']) {
      const errors = await validateDto({ ...base, archiveFormat: fmt });
      expect(errors).toHaveLength(0);
    }
  });

  it('fails when zipCompression is not an accepted value', async () => {
    const errors = await validateDto({ ...base, zipCompression: 'ultra' });
    expect(constraintNames(errors)).toEqual(expect.arrayContaining(['isIn']));
  });

  it('passes with valid zipCompression values', async () => {
    for (const c of ['store', 'fast', 'default', 'best']) {
      const errors = await validateDto({ ...base, zipCompression: c });
      expect(errors).toHaveLength(0);
    }
  });

  it('fails when noArchive is not a boolean', async () => {
    const errors = await validateDto({ ...base, noArchive: 'yes' });
    expect(constraintNames(errors)).toEqual(
      expect.arrayContaining(['isBoolean']),
    );
  });

  it('passes with noArchive = true', async () => {
    const errors = await validateDto({ ...base, noArchive: true });
    expect(errors).toHaveLength(0);
  });

  it('passes with backupType = input', async () => {
    const errors = await validateDto({ ...base, backupType: 'input' });
    expect(errors).toHaveLength(0);
  });

  it('fails when backupType is not local or input', async () => {
    const errors = await validateDto({ ...base, backupType: 'remote' });
    expect(constraintNames(errors)).toEqual(expect.arrayContaining(['isIn']));
  });
});

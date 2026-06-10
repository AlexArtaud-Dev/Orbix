import { validate } from 'class-validator';
import { CreateInputDto } from './create-input.dto';

async function valid(partial: Partial<CreateInputDto>): Promise<void> {
  const dto = Object.assign(new CreateInputDto(), partial);
  const errors = await validate(dto);
  if (errors.length)
    throw new Error(errors.map((e) => e.toString()).join('\n'));
}

async function invalid(partial: Partial<CreateInputDto>): Promise<string[]> {
  const dto = Object.assign(new CreateInputDto(), partial);
  const errors = await validate(dto);
  return errors.map((e) => Object.keys(e.constraints ?? {}).join(',')).flat();
}

describe('CreateInputDto', () => {
  const base: Partial<CreateInputDto> = {
    name: 'My Input',
    type: 'http-rest',
    config: { baseUrl: 'https://api.example.com' },
  };

  it('passes with all required fields', async () => {
    await expect(valid(base)).resolves.toBeUndefined();
  });

  it('fails when name is empty string', async () => {
    const errors = await invalid({ ...base, name: '' });
    expect(errors.join(',')).toMatch(/isNotEmpty/);
  });

  it('fails when name is missing', async () => {
    const errors = await invalid({ type: base.type, config: base.config });
    expect(errors.join(',')).toMatch(/isString|isNotEmpty/);
  });

  it('fails when type is not http-rest', async () => {
    const errors = await invalid({ ...base, type: 'ftp' });
    expect(errors.join(',')).toMatch(/isIn/);
  });

  it('fails when config is not an object', async () => {
    const errors = await invalid({
      ...base,
      config: 'not-an-object' as unknown as Record<string, unknown>,
    });
    expect(errors.join(',')).toMatch(/isObject/);
  });

  it('passes with enabled = false', async () => {
    await expect(valid({ ...base, enabled: false })).resolves.toBeUndefined();
  });

  it('fails when enabled is not a boolean', async () => {
    const errors = await invalid({
      ...base,
      enabled: 'yes' as unknown as boolean,
    });
    expect(errors.join(',')).toMatch(/isBoolean/);
  });

  it('passes with vaultId = null', async () => {
    await expect(valid({ ...base, vaultId: null })).resolves.toBeUndefined();
  });

  it('passes with vaultId as a string', async () => {
    await expect(
      valid({ ...base, vaultId: 'vault-abc' }),
    ).resolves.toBeUndefined();
  });
});

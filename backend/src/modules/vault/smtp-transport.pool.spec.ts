import { SmtpTransportPool } from './smtp-transport.pool';
import type { VaultService } from './vault.service';
import type { EmailPayload } from './vault.types';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ close: jest.fn() })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockNodemailer = require('nodemailer') as { createTransport: jest.Mock };

const basePayload: EmailPayload = {
  host: 'smtp.example.com',
  port: 587,
  user: 'user@example.com',
  password: 'secret',
  fromAddr: 'user@example.com',
  fromName: 'Orbix',
  secure: false,
};

describe('SmtpTransportPool', () => {
  let payload: EmailPayload;
  let pool: SmtpTransportPool;

  beforeEach(() => {
    mockNodemailer.createTransport.mockClear();
    payload = { ...basePayload };
    const vault = {
      getEmailPayload: jest.fn(() => Promise.resolve(payload)),
    } as unknown as VaultService;
    pool = new SmtpTransportPool(vault);
  });

  it('creates a single-connection pooled transport', async () => {
    await pool.get('vault-1');

    expect(mockNodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ pool: true, maxConnections: 1 }),
    );
  });

  it('reuses the same transport for concurrent sends on one vault', async () => {
    const [a, b] = await Promise.all([
      pool.get('vault-1'),
      pool.get('vault-1'),
    ]);

    expect(a.transporter).toBe(b.transporter);
    expect(mockNodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  it('replaces and closes the transport when credentials change', async () => {
    const first = await pool.get('vault-1');
    payload = { ...basePayload, password: 'rotated' };

    const second = await pool.get('vault-1');

    expect(second.transporter).not.toBe(first.transporter);
    expect(
      (first.transporter as unknown as { close: jest.Mock }).close,
    ).toHaveBeenCalled();
  });

  it('keeps separate transports per vault', async () => {
    const a = await pool.get('vault-1');
    const b = await pool.get('vault-2');

    expect(a.transporter).not.toBe(b.transporter);
  });
});

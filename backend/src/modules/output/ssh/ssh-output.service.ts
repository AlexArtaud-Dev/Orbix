import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { VaultService } from '../../vault/vault.service';
import { LogsWriter } from '../../logs/logs.writer';
import type { CreateSshOutputDto } from './dto/create-ssh-output.dto';
import type { UpdateSshOutputDto } from './dto/update-ssh-output.dto';

@Injectable()
export class SshOutputService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly logs: LogsWriter,
  ) {}

  list() {
    return this.prisma.sshOutputConfig.findMany({ orderBy: { name: 'asc' } });
  }

  async getOne(id: string) {
    const item = await this.prisma.sshOutputConfig.findUnique({
      where: { id },
    });
    if (!item)
      throw new NotFoundException(`SSH output config "${id}" not found`);
    return item;
  }

  async create(dto: CreateSshOutputDto) {
    try {
      return await this.prisma.sshOutputConfig.create({ data: dto });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException('SSH output config name already exists');
      throw e;
    }
  }

  async update(id: string, dto: UpdateSshOutputDto) {
    const existing = await this.prisma.sshOutputConfig.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('SSH output config not found');

    const configChanging =
      dto.vaultId !== undefined || dto.destPath !== undefined;

    try {
      return await this.prisma.sshOutputConfig.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.vaultId !== undefined ? { vaultId: dto.vaultId } : {}),
          ...(dto.destPath !== undefined ? { destPath: dto.destPath } : {}),
          ...(configChanging
            ? { lastTestStatus: null, lastTestError: null, lastTestAt: null }
            : {}),
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002')
        throw new ConflictException('SSH output config name already exists');
      throw e;
    }
  }

  async delete(id: string) {
    const existing = await this.prisma.sshOutputConfig.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('SSH output config not found');
    await this.prisma.sshOutputConfig.delete({ where: { id } });
    this.logs.info(
      'system',
      'SSH_OUTPUT_DELETED',
      `SSH output deleted: ${existing.name}`,
      undefined,
    );
  }

  async test(id: string): Promise<{
    steps: { connection: string; path: string; write: string };
    ok: boolean;
  }> {
    const config = await this.prisma.sshOutputConfig.findUnique({
      where: { id },
    });
    if (!config) throw new NotFoundException('SSH output config not found');

    const payload = await this.vault.getSshPayload(config.vaultId);
    const steps = { connection: 'pending', path: 'pending', write: 'pending' };
    let ok = false;

    const { Client } = await import('ssh2');

    const password =
      payload.subtype === 'user_password' ? payload.password : undefined;
    const sudoPassword =
      payload.subtype === 'user_password'
        ? payload.password
        : (payload.sudoPassword ?? '');

    const connect = (): Promise<InstanceType<typeof Client>> =>
      new Promise((resolve, reject) => {
        const conn = new Client();
        conn
          .on('ready', () => resolve(conn))
          .on('error', (err) => reject(err))
          .on('keyboard-interactive', (_n, _i, _l, _p, finish) =>
            finish([password ?? '']),
          )
          .connect({
            host: payload.host,
            port: payload.port,
            username: payload.username,
            readyTimeout: 10000,
            tryKeyboard: payload.subtype === 'user_password',
            ...(payload.subtype === 'user_password'
              ? { password }
              : {
                  privateKey: Buffer.from(payload.privateKey ?? '', 'utf8'),
                  passphrase: payload.passphrase,
                }),
          });
      });

    const exec = (
      conn: InstanceType<typeof Client>,
      cmd: string,
    ): Promise<string> =>
      new Promise((resolve, reject) => {
        const useSudo = payload.useSudo ?? false;
        const fullCmd = useSudo
          ? `sudo -S -p '' sh -c ${JSON.stringify(cmd)}`
          : cmd;
        conn.exec(fullCmd, (err, stream) => {
          if (err) return reject(err);
          if (useSudo) stream.write(sudoPassword + '\n');
          let out = '';
          let errOut = '';
          stream.on('data', (d: Buffer) => {
            out += d.toString();
          });
          stream.stderr.on('data', (d: Buffer) => {
            errOut += d.toString();
          });
          stream.on('close', (code: number) => {
            if (code === 0) resolve(out.trim());
            else reject(new Error(errOut.trim() || `Exit code ${code}`));
          });
        });
      });

    let conn: InstanceType<typeof Client> | null = null;
    try {
      conn = await connect();
      steps.connection = 'ok';

      await exec(conn, `test -d ${JSON.stringify(config.destPath)}`);
      steps.path = 'ok';

      const tmpFile = `${config.destPath.replace(/\/+$/, '')}/.orbix_write_test`;
      await exec(
        conn,
        `touch ${JSON.stringify(tmpFile)} && rm ${JSON.stringify(tmpFile)}`,
      );
      steps.write = 'ok';
      ok = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (steps.connection === 'pending') steps.connection = `error: ${msg}`;
      else if (steps.path === 'pending') steps.path = `error: ${msg}`;
      else steps.write = `error: ${msg}`;
    } finally {
      conn?.end();
    }

    const errorMsg = ok
      ? null
      : (Object.values(steps).find((s) => s.startsWith('error:')) ?? null);

    await this.prisma.sshOutputConfig.update({
      where: { id },
      data: {
        lastTestAt: new Date(),
        lastTestStatus: ok ? 'ok' : 'error',
        lastTestError: errorMsg,
      },
    });

    return { steps, ok };
  }
}

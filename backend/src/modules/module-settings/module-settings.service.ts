import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ModuleSettingsRegistry } from '../../providers/module-settings.registry';
import type { ModuleSettingsDefinition } from '../../providers/module-settings.types';

export interface ModuleSettingsWithValues {
  definition: ModuleSettingsDefinition;
  values: Record<string, unknown>;
}

@Injectable()
export class ModuleSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ModuleSettingsRegistry,
  ) {}

  private async loadValues(module: string): Promise<Record<string, unknown>> {
    const def = this.registry.get(module);
    const result: Record<string, unknown> = {};
    if (def) {
      for (const field of def.fields) {
        result[field.key] = field.defaultValue;
      }
    }
    const rows = await this.prisma.moduleSetting.findMany({
      where: { module },
    });
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value) as unknown;
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }

  async getAll(): Promise<ModuleSettingsWithValues[]> {
    const defs = this.registry.all();
    return Promise.all(
      defs.map(async (def) => ({
        definition: def,
        values: await this.loadValues(def.module),
      })),
    );
  }

  async getOne(module: string): Promise<ModuleSettingsWithValues> {
    const def = this.registry.get(module);
    if (!def) throw new NotFoundException(`Module "${module}" not found`);
    return { definition: def, values: await this.loadValues(module) };
  }

  async setValues(
    module: string,
    values: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const def = this.registry.get(module);
    if (!def) throw new NotFoundException(`Module "${module}" not found`);
    for (const [key, value] of Object.entries(values)) {
      if (!def.fields.some((f) => f.key === key)) continue;
      await this.prisma.moduleSetting.upsert({
        where: { module_key: { module, key } },
        update: { value: JSON.stringify(value) },
        create: { module, key, value: JSON.stringify(value) },
      });
    }
    return this.loadValues(module);
  }
}

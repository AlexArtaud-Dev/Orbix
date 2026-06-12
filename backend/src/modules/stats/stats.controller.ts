import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  async get(@Query('period') period?: string) {
    const validPeriod =
      period === '7d' || period === '30d' || period === '365d' ? period : '30d';
    return { data: await this.stats.get(validPeriod) };
  }
}

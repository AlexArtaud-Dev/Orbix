import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { LogsModule } from './modules/logs/logs.module';
import { SettingsModule } from './modules/settings/settings.module';
import { VaultModule } from './modules/vault/vault.module';
import { FilesModule } from './modules/files/files.module';
import { MailModule } from './modules/mail/mail.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { BackupModule } from './modules/backup/backup.module';
import { InputModule } from './modules/input/input.module';
import { StatsModule } from './modules/stats/stats.module';
import { ModuleSettingsModule } from './modules/module-settings/module-settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ScheduleModule.forRoot(),
    LogsModule,
    AuthModule,
    SettingsModule,
    VaultModule,
    FilesModule,
    MailModule,
    ContactsModule,
    InputModule,
    BackupModule,
    StatsModule,
    ModuleSettingsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { BackupService } from './backup.service';
import { NotifyService } from '../../services/notify/notify.service';
import { TelegramService } from '../../services/notify/telegram.service';
import { FeishuService } from '../../services/notify/feishu.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'backup',
    }),
  ],
  providers: [BackupService, NotifyService, TelegramService, FeishuService],
  exports: [BackupService],
})
export class BackupModule {}

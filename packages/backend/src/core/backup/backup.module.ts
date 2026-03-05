import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { BackupService } from './backup.service';
import { NotifyService } from '../../services/notify/notify.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'backup',
    }),
  ],
  providers: [BackupService, NotifyService],
  exports: [BackupService],
})
export class BackupModule {}

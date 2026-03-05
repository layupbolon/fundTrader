import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BackupService } from '../core/backup/backup.service';

@Processor('backup')
@Injectable()
export class BackupProcessor {
  private readonly logger = new Logger(BackupProcessor.name);

  constructor(
    @InjectQueue('backup') private readonly backupQueue: Queue,
    private readonly backupService: BackupService,
  ) {}

  @Process('create-backup')
  async handleCreateBackup(_job: Job) {
    this.logger.log('Creating database backup...');

    try {
      const result = await this.backupService.createBackup();

      if (result.success) {
        this.logger.log(`Backup completed: ${result.filename}`);
      } else {
        this.logger.error(`Backup failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Backup process failed: ${errorMessage}`, error);
      throw error;
    }
  }

  @Process('cleanup-old-backups')
  async handleCleanupOldBackups(_job: Job) {
    this.logger.log('Cleaning up old backups...');

    try {
      const result = await this.backupService.cleanupOldBackups();

      if (result.deleted.length > 0) {
        this.logger.log(`Deleted ${result.deleted.length} old backups`);
      } else {
        this.logger.debug('No old backups to delete');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cleanup process failed: ${errorMessage}`, error);
      throw error;
    }
  }
}

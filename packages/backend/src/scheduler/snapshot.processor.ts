import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../models/user.entity';
import { AnalyticsService } from '../core/analytics/analytics.service';

@Processor('data-sync')
@Injectable()
export class SnapshotProcessor {
  private readonly logger = new Logger(SnapshotProcessor.name);

  constructor(
    private readonly analyticsService: AnalyticsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Process('create-snapshot')
  async handleCreateSnapshot(_job: Job) {
    this.logger.log('Creating daily portfolio snapshots...');

    try {
      // 获取所有用户
      const users = await this.userRepository.find({
        select: ['id'],
      });

      this.logger.log(`Found ${users.length} users`);

      // 为每个用户创建快照
      let successCount = 0;
      let failCount = 0;

      for (const user of users) {
        try {
          await this.analyticsService.createSnapshot(user.id);
          successCount++;
          this.logger.debug(`Created snapshot for user ${user.id}`);
        } catch (error) {
          failCount++;
          this.logger.error(`Failed to create snapshot for user ${user.id}: ${error.message}`);
        }
      }

      this.logger.log(
        `Snapshot creation completed: ${successCount} succeeded, ${failCount} failed`,
      );
    } catch (error) {
      this.logger.error(`Failed to create snapshots: ${error.message}`, error);
      throw error;
    }
  }
}

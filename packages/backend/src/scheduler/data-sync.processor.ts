import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FundDataService } from '../services/data/fund-data.service';

@Processor('data-sync')
@Injectable()
export class DataSyncProcessor {
  constructor(private fundDataService: FundDataService) {}

  @Process('sync-nav')
  async handleSyncNav(_job: Job) {
    console.log('Syncing fund NAV data...');

    try {
      await this.fundDataService.syncAllFundNav();
      console.log('Fund NAV sync completed');
    } catch (error) {
      console.error('Failed to sync fund NAV:', error);
    }
  }
}

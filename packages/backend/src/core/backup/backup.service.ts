import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { NotifyService } from '../../services/notify/notify.service';

const execAsync = promisify(exec);

export interface BackupFile {
  filename: string;
  path: string;
  size: number;
  createdAt: Date;
}

export interface BackupResult {
  success: boolean;
  filename?: string;
  error?: string;
}

/**
 * 数据库备份服务
 *
 * 提供 PostgreSQL 数据库的备份和恢复功能。
 *
 * 核心功能：
 * - 创建数据库备份（使用 pg_dump）
 * - 恢复数据库（使用 pg_restore）
 * - 列出所有备份文件
 * - 删除指定备份
 * - 自动清理过期备份
 *
 * 备份文件命名格式：backup_YYYYMMDD_HHMMSS.sql.gz
 *
 * @see {@link https://www.postgresql.org/docs/current/backup.html PostgreSQL Backup Documentation}
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly retentionDays: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly notifyService: NotifyService,
  ) {
    this.backupDir = this.configService.get<string>('backup.directory') || './backups';
    this.retentionDays = this.configService.get<number>('backup.retention_days') || 7;

    // 确保备份目录存在
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 创建数据库备份
   *
   * 执行 backup.sh 脚本创建数据库备份。
   * 备份文件会自动压缩并保存到备份目录。
   *
   * @returns Promise<BackupResult> 备份结果
   *
   * @example
   * const result = await backupService.createBackup();
   * if (result.success) {
   *   console.log('Backup created:', result.filename);
   * }
   */
  async createBackup(): Promise<BackupResult> {
    this.logger.log('Creating database backup...');

    try {
      const { stdout, stderr } = await execAsync('bash backup.sh', {
        cwd: path.join(__dirname, '../../../scripts'),
        env: process.env,
      });

      if (stderr) {
        this.logger.warn(`Backup warnings: ${stderr}`);
      }

      // 提取文件名（脚本输出的最后一行）
      const lines = stdout.trim().split('\n');
      const filename = lines[lines.length - 1].trim();

      this.logger.log(`Backup created successfully: ${filename}`);

      // 发送通知
      await this.notifyService.send({
        title: '数据库备份成功',
        content: `备份文件：${filename}\n时间：${new Date().toISOString()}`,
        level: 'info',
      });

      return {
        success: true,
        filename,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Backup failed: ${errorMessage}`, error);

      // 发送错误通知
      await this.notifyService.send({
        title: '数据库备份失败',
        content: `错误：${errorMessage}\n时间：${new Date().toISOString()}`,
        level: 'error',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 恢复数据库
   *
   * 执行 restore.sh 脚本从备份文件恢复数据库。
   *
   * @param filename 备份文件名
   * @returns Promise<{ success: boolean; error?: string }> 恢复结果
   *
   * @example
   * const result = await backupService.restoreBackup('backup_20260305_020000.sql.gz');
   * if (result.success) {
   *   console.log('Database restored successfully');
   * }
   */
  async restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`Restoring database from backup: ${filename}`);

    try {
      // 验证备份文件存在
      const backupPath = path.join(this.backupDir, filename);
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${filename}`);
      }

      const { stdout, stderr } = await execAsync(`bash restore.sh "${filename}"`, {
        cwd: path.join(__dirname, '../../../scripts'),
        env: process.env,
      });

      if (stderr) {
        this.logger.warn(`Restore warnings: ${stderr}`);
      }

      this.logger.log(`Database restored successfully from: ${filename}`);
      this.logger.log(stdout);

      // 发送通知
      await this.notifyService.send({
        title: '数据库恢复成功',
        content: `备份文件：${filename}\n时间：${new Date().toISOString()}`,
        level: 'info',
      });

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Restore failed: ${errorMessage}`, error);

      // 发送错误通知
      await this.notifyService.send({
        title: '数据库恢复失败',
        content: `备份文件：${filename}\n错误：${errorMessage}\n时间：${new Date().toISOString()}`,
        level: 'error',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 列出所有备份文件
   *
   * 返回备份目录中的所有备份文件列表，按创建时间倒序排列。
   *
   * @returns Promise<BackupFile[]> 备份文件列表
   *
   * @example
   * const backups = await backupService.listBackups();
   * backups.forEach(backup => {
   *   console.log(`${backup.filename} - ${backup.size} bytes`);
   * });
   */
  async listBackups(): Promise<BackupFile[]> {
    this.logger.debug('Listing backup files...');

    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFiles: BackupFile[] = [];

      for (const file of files) {
        if (file.startsWith('backup_') && file.endsWith('.sql.gz')) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);

          // 从文件名解析日期时间 backup_YYYYMMDD_HHMMSS.sql.gz
          const dateMatch = file.match(/backup_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.sql\.gz/);
          let createdAt: Date;

          if (dateMatch) {
            const [, year, month, day, hour, minute, second] = dateMatch;
            createdAt = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              parseInt(hour),
              parseInt(minute),
              parseInt(second),
            );
          } else {
            createdAt = stats.birthtime;
          }

          backupFiles.push({
            filename: file,
            path: filePath,
            size: stats.size,
            createdAt,
          });
        }
      }

      // 按创建时间倒序排列
      backupFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      this.logger.debug(`Found ${backupFiles.length} backup files`);
      return backupFiles;
    } catch (error) {
      this.logger.error(`Failed to list backups: ${error instanceof Error ? error.message : error}`);
      return [];
    }
  }

  /**
   * 获取备份文件路径
   *
   * @param filename 备份文件名
   * @returns string | null 文件路径，如果文件不存在返回 null
   */
  getBackupFilePath(filename: string): string | null {
    const filePath = path.join(this.backupDir, filename);
    return fs.existsSync(filePath) ? filePath : null;
  }

  /**
   * 删除指定备份文件
   *
   * @param filename 备份文件名
   * @returns Promise<{ success: boolean; error?: string }> 删除结果
   *
   * @example
   * const result = await backupService.deleteBackup('backup_20260305_020000.sql.gz');
   * if (result.success) {
   *   console.log('Backup deleted');
   * }
   */
  async deleteBackup(filename: string): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`Deleting backup: ${filename}`);

    try {
      const filePath = path.join(this.backupDir, filename);

      if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file not found: ${filename}`);
      }

      fs.unlinkSync(filePath);
      this.logger.log(`Backup deleted successfully: ${filename}`);

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete backup: ${errorMessage}`, error);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 清理过期备份
   *
   * 删除超过保留天数的备份文件。
   *
   * @returns Promise<{ deleted: string[]; error?: string }> 已删除的文件列表
   *
   * @example
   * const result = await backupService.cleanupOldBackups();
   * console.log('Deleted old backups:', result.deleted);
   */
  async cleanupOldBackups(): Promise<{ deleted: string[]; error?: string }> {
    this.logger.log(`Cleaning up backups older than ${this.retentionDays} days...`);

    try {
      const now = new Date();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

      const backups = await this.listBackups();
      const deleted: string[] = [];

      for (const backup of backups) {
        if (backup.createdAt < cutoffDate) {
          const result = await this.deleteBackup(backup.filename);
          if (result.success) {
            deleted.push(backup.filename);
            this.logger.debug(`Deleted old backup: ${backup.filename}`);
          }
        }
      }

      this.logger.log(`Cleanup completed. Deleted ${deleted.length} old backups.`);

      if (deleted.length > 0) {
        await this.notifyService.send({
          title: '过期备份清理完成',
          content: `已删除 ${deleted.length} 个过期备份\n保留策略：${this.retentionDays} 天`,
          level: 'info',
        });
      }

      return {
        deleted,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cleanup failed: ${errorMessage}`, error);

      return {
        deleted: [],
        error: errorMessage,
      };
    }
  }
}

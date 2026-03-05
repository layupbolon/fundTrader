import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  BadRequestException,
  NotFoundException,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { BackupService } from '../core/backup/backup.service';
import { BackupFile } from '../core/backup/backup.service';

interface RestoreDto {
  filename: string;
  confirm: boolean;
}

@ApiBearerAuth()
@ApiTags('backup')
@Controller('backups')
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @ApiOperation({
    summary: '获取备份列表',
    description: '获取所有数据库备份文件列表，按创建时间倒序排列',
  })
  @ApiResponse({
    status: 200,
    description: '成功返回备份文件列表',
    schema: {
      example: [
        {
          filename: 'backup_20260305_020000.sql.gz',
          path: './backups/backup_20260305_020000.sql.gz',
          size: 1048576,
          createdAt: '2026-03-05T02:00:00.000Z',
        },
      ],
    },
  })
  async getBackups(): Promise<BackupFile[]> {
    return this.backupService.listBackups();
  }

  @Get(':filename')
  @ApiOperation({
    summary: '下载备份文件',
    description: '下载指定的数据库备份文件',
  })
  @ApiParam({
    name: 'filename',
    description: '备份文件名',
    example: 'backup_20260305_020000.sql.gz',
  })
  @ApiResponse({ status: 200, description: '成功返回备份文件' })
  @ApiResponse({ status: 404, description: '备份文件不存在' })
  async downloadBackup(@Param('filename') filename: string, @Res() res: Response): Promise<void> {
    const filePath = this.backupService.getBackupFilePath(filename);

    if (!filePath) {
      throw new NotFoundException(`Backup file not found: ${filename}`);
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      throw new NotFoundException('Backup file is empty');
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Length', stats.size.toString());

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Post('backup')
  @ApiOperation({
    summary: '创建数据库备份',
    description: '手动触发数据库备份，备份文件会自动保存到备份目录',
  })
  @ApiResponse({
    status: 201,
    description: '备份创建成功',
    schema: {
      example: {
        success: true,
        filename: 'backup_20260305_143000.sql.gz',
      },
    },
  })
  @ApiResponse({ status: 500, description: '备份失败' })
  @HttpCode(HttpStatus.CREATED)
  async createBackup(): Promise<{ success: boolean; filename?: string; error?: string }> {
    return this.backupService.createBackup();
  }

  @Post('restore')
  @ApiOperation({
    summary: '恢复数据库',
    description: '从指定的备份文件恢复数据库。⚠️ 警告：此操作会覆盖当前数据库所有数据！',
  })
  @ApiBody({
    schema: {
      example: {
        filename: 'backup_20260305_020000.sql.gz',
        confirm: true,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '恢复成功',
    schema: {
      example: {
        success: true,
      },
    },
  })
  @ApiResponse({ status: 400, description: '未确认操作或参数错误' })
  @ApiResponse({ status: 404, description: '备份文件不存在' })
  @ApiResponse({ status: 500, description: '恢复失败' })
  async restoreBackup(@Body() body: RestoreDto): Promise<{ success: boolean; error?: string }> {
    if (!body.filename) {
      throw new BadRequestException('filename is required');
    }

    if (!body.confirm) {
      throw new BadRequestException(
        'Restore operation requires confirmation. Set confirm: true to proceed.',
      );
    }

    return this.backupService.restoreBackup(body.filename);
  }

  @Delete(':filename')
  @ApiOperation({
    summary: '删除备份文件',
    description: '永久删除指定的数据库备份文件',
  })
  @ApiParam({
    name: 'filename',
    description: '备份文件名',
    example: 'backup_20260305_020000.sql.gz',
  })
  @ApiResponse({ status: 200, description: '删除成功' })
  @ApiResponse({ status: 404, description: '备份文件不存在' })
  async deleteBackup(
    @Param('filename') filename: string,
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.backupService.deleteBackup(filename);

    if (!result.success) {
      throw new NotFoundException(result.error);
    }

    return result;
  }

  @Post('cleanup')
  @ApiOperation({
    summary: '清理过期备份',
    description: '删除超过保留天数（默认 7 天）的备份文件',
  })
  @ApiResponse({
    status: 200,
    description: '清理完成',
    schema: {
      example: {
        deleted: ['backup_20260220_020000.sql.gz', 'backup_20260221_020000.sql.gz'],
      },
    },
  })
  @HttpCode(HttpStatus.OK)
  async cleanupOldBackups(): Promise<{ deleted: string[]; error?: string }> {
    return this.backupService.cleanupOldBackups();
  }
}

import { Repository } from 'typeorm';
import { OperationLog, OperationStatus, OperationType } from '../../../models/operation-log.entity';
import { OperationLogService } from '../operation-log.service';

describe('OperationLogService', () => {
  function createService(logs: OperationLog[]) {
    const queryBuilder = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(logs),
    };
    const repository = {
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    } as unknown as Repository<OperationLog>;

    return {
      service: new OperationLogService(repository),
      queryBuilder,
    };
  }

  function createPaperLog(
    id: string,
    createdAt: Date,
    context: Record<string, unknown>,
    description = '交易提交到券商',
  ): OperationLog {
    return {
      id,
      user_id: 'user1',
      operation_type: OperationType.TRADE_CONFIRM,
      status: OperationStatus.SUCCESS,
      module: 'trade',
      description,
      context,
      created_at: createdAt,
    } as OperationLog;
  }

  it('should aggregate paper trading logs by run id', async () => {
    const { service } = createService([
      createPaperLog(
        'log-2',
        new Date('2026-04-30T02:00:00.000Z'),
        {
          broker_mode: 'paper',
          paper_trading_run_id: 'paper-tx-1',
          transaction_id: 'tx-1',
          order_id: 'PAPER_BUY_tx-1',
          reason: 'broker_order_persist_failed',
          manual_intervention_required: true,
          broker_evidence: {
            screenshotPath: '/tmp/broker-artifacts/tx-1.png',
            domSummary:
              '请输入验证码后继续交易\n页面包含敏感输入框和交易上下文，需要人工接管后继续处理。'.repeat(
                4,
              ),
            capturedAt: '2026-04-30T02:00:00.000Z',
            operation: 'buyFund',
          },
        },
        '交易提交本地持久化失败 tx-1',
      ),
      createPaperLog('log-1', new Date('2026-04-30T01:00:00.000Z'), {
        broker_mode: 'paper',
        paper_trading_run_id: 'paper-tx-1',
        transaction_id: 'tx-1',
        order_id: 'PAPER_BUY_tx-1',
        broker_order_created_at: '2026-04-30T00:59:59.000Z',
        reason: 'broker_submit_success',
      }),
    ]);

    const runs = await service.findPaperTradingRuns(7, 20);

    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual(
      expect.objectContaining({
        runId: 'paper-tx-1',
        transactionId: 'tx-1',
        orderId: 'PAPER_BUY_tx-1',
        brokerOrderCreatedAt: '2026-04-30T00:59:59.000Z',
        submittedCount: 1,
        failedCount: 1,
        manualInterventionCount: 1,
        latestReason: 'broker_order_persist_failed',
      }),
    );
    expect(runs[0].events).toHaveLength(2);
    expect(runs[0].events[0].brokerEvidence).toEqual(
      expect.objectContaining({
        hasScreenshot: true,
        capturedAt: '2026-04-30T02:00:00.000Z',
        operation: 'buyFund',
      }),
    );
    expect(runs[0].events[0].brokerEvidence).not.toHaveProperty('screenshotPath');
    expect(runs[0].events[0].brokerEvidence).not.toHaveProperty('domSummary');
    expect(runs[0].events[0].brokerEvidence?.domSummaryPreview).toContain('请输入验证码后继续交易');
    expect(runs[0].events[0].brokerEvidence?.domSummaryPreview).not.toContain('\n');
    expect(runs[0].events[0].brokerEvidence?.domSummaryPreview?.length).toBeLessThanOrEqual(160);
  });

  it('should query only recent paper trading trade logs', async () => {
    const { service, queryBuilder } = createService([]);

    await service.findPaperTradingRuns(14, 5);

    expect(queryBuilder.where).toHaveBeenCalledWith("log.context ->> 'broker_mode' = :mode", {
      mode: 'paper',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.module = :module', {
      module: 'trade',
    });
    expect(queryBuilder.limit).toHaveBeenCalledWith(50);
  });
});

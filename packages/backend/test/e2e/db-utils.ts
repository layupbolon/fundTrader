import { DataSource } from 'typeorm';
import { Fund, FundNav, RiskLimit, RiskLimitType } from '../../src/models';

function quoteTablePath(tablePath: string): string {
  return tablePath
    .split('.')
    .map((segment) => `"${segment}"`)
    .join('.');
}

export async function resetDatabase(dataSource: DataSource): Promise<void> {
  const tablePaths = dataSource.entityMetadatas.map((meta) => quoteTablePath(meta.tablePath));

  if (tablePaths.length === 0) {
    return;
  }

  await dataSource.query(`TRUNCATE TABLE ${tablePaths.join(', ')} RESTART IDENTITY CASCADE`);
}

export async function seedFund(
  dataSource: DataSource,
  fund: { code: string; name: string; type?: string; manager?: string } = {
    code: '110011',
    name: '易方达中小盘',
    type: '混合型',
    manager: '张三',
  },
): Promise<Fund> {
  const repo = dataSource.getRepository(Fund);
  const entity = repo.create(fund);
  return repo.save(entity);
}

export async function seedFundNavSeries(
  dataSource: DataSource,
  options: {
    fundCode: string;
    startDate: string;
    days: number;
    baseNav?: number;
  },
): Promise<void> {
  const repo = dataSource.getRepository(FundNav);
  const baseNav = options.baseNav ?? 1;

  for (let i = 0; i < options.days; i++) {
    const date = new Date(options.startDate);
    date.setDate(date.getDate() + i);

    const nav = Number((baseNav + i * 0.01).toFixed(4));
    const accNav = Number((nav + 0.05).toFixed(4));

    await repo.save(
      repo.create({
        fund_code: options.fundCode,
        nav,
        acc_nav: accNav,
        date,
        growth_rate: i === 0 ? 0 : 0.01,
      }),
    );
  }
}

export async function seedRiskLimit(
  dataSource: DataSource,
  options: {
    userId: string;
    type: RiskLimitType;
    limitValue: number;
    enabled?: boolean;
    description?: string;
  },
): Promise<RiskLimit> {
  const repo = dataSource.getRepository(RiskLimit);

  return repo.save(
    repo.create({
      user_id: options.userId,
      type: options.type,
      limit_value: options.limitValue,
      enabled: options.enabled ?? true,
      description: options.description,
      current_usage: 0,
    }),
  );
}

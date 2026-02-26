import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fund, FundNav } from '../../models';
import { formatDate } from '../../utils';

/**
 * 基金信息接口
 *
 * 从外部 API 获取的基金基本信息。
 */
interface FundInfo {
  /** 基金代码 */
  code: string;

  /** 基金名称 */
  name: string;

  /** 基金类型（可选） */
  type?: string;

  /** 基金经理（可选） */
  manager?: string;
}

/**
 * 净值数据接口
 *
 * 从外部 API 获取的基金净值数据。
 */
interface NavData {
  /** 单位净值 */
  nav: number;

  /** 累计净值 */
  accNav: number;

  /** 净值日期 */
  date: Date;

  /** 日增长率（可选） */
  growthRate?: number;
}

/**
 * 基金数据服务
 *
 * 负责从外部 API 获取基金数据并存储到数据库。
 * 提供基金信息查询、净值查询和历史数据同步功能。
 *
 * 数据来源：
 * - 天天基金 API (fundgz.1234567.com.cn): 实时净值数据
 * - 东方财富 API (fund.eastmoney.com): 基金信息和历史净值
 *
 * 核心功能：
 * 1. 获取基金基本信息（代码、名称、类型、基金经理）
 * 2. 获取基金实时净值
 * 3. 获取历史净值数据
 * 4. 同步历史净值到数据库
 * 5. 批量同步所有基金净值
 *
 * 缓存策略：
 * - 优先从数据库读取数据
 * - 数据库没有时从 API 获取并缓存
 * - 定时任务定期同步最新数据
 *
 * 使用场景：
 * - 策略执行时获取最新净值
 * - 回测系统加载历史数据
 * - 持仓计算当前市值
 * - 数据分析和可视化
 */
@Injectable()
export class FundDataService {
  constructor(
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
    @InjectRepository(FundNav)
    private fundNavRepository: Repository<FundNav>,
  ) {}

  /**
   * 获取基金基本信息
   *
   * 优先从数据库读取，如果不存在则从 API 获取并缓存到数据库。
   *
   * @param fundCode 基金代码
   * @returns 基金信息
   *
   * @example
   * const fund = await fundDataService.getFundInfo('000001');
   * console.log(fund.name); // 华夏成长混合
   */
  async getFundInfo(fundCode: string): Promise<Fund> {
    // 先从数据库查询
    let fund = await this.fundRepository.findOne({ where: { code: fundCode } });

    if (!fund) {
      // 数据库没有时从 API 获取
      const info = await this.fetchFundInfoFromApi(fundCode);

      // 创建并保存到数据库
      fund = this.fundRepository.create({
        code: fundCode,
        name: info.name,
        type: info.type,
        manager: info.manager,
      });
      await this.fundRepository.save(fund);
    }

    return fund;
  }

  /**
   * 获取基金净值
   *
   * 获取指定日期的基金净值，优先从数据库读取，不存在则从 API 获取。
   *
   * @param fundCode 基金代码
   * @param date 查询日期，默认为当前日期
   * @returns 基金净值数据，如果不存在返回 null
   *
   * @example
   * // 获取最新净值
   * const nav = await fundDataService.getFundNav('000001');
   * console.log(nav.nav); // 1.2345
   *
   * @example
   * // 获取指定日期净值
   * const nav = await fundDataService.getFundNav('000001', new Date('2026-02-25'));
   */
  async getFundNav(fundCode: string, date?: Date): Promise<FundNav | null> {
    const queryDate = date || new Date();
    const dateStr = formatDate(queryDate);

    // 先从数据库查询
    let nav = await this.fundNavRepository.findOne({
      where: { fund_code: fundCode, date: dateStr as any },
    });

    if (!nav) {
      // 数据库没有时从 API 获取
      const navData = await this.fetchNavFromApi(fundCode, queryDate);
      if (navData) {
        // 创建并保存到数据库
        nav = this.fundNavRepository.create({
          fund_code: fundCode,
          nav: navData.nav,
          acc_nav: navData.accNav,
          date: navData.date,
          growth_rate: navData.growthRate,
        });
        await this.fundNavRepository.save(nav);
      }
    }

    return nav;
  }

  /**
   * 获取历史净值数据
   *
   * 获取指定时间范围内的历史净值数据，用于回测和数据分析。
   * 优先从数据库读取，如果数据不完整则从 API 同步。
   *
   * @param fundCode 基金代码
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 历史净值数据数组，按日期升序排列
   *
   * @example
   * // 获取2023年全年的历史净值
   * const navs = await fundDataService.getHistoricalNav(
   *   '000001',
   *   new Date('2023-01-01'),
   *   new Date('2023-12-31')
   * );
   * console.log(`共 ${navs.length} 条记录`);
   */
  async getHistoricalNav(fundCode: string, startDate: Date, endDate: Date): Promise<FundNav[]> {
    // 先尝试从数据库获取
    let navs = await this.fundNavRepository.find({
      where: {
        fund_code: fundCode,
      },
      order: { date: 'ASC' },
    });

    // 过滤日期范围
    const filteredNavs = navs.filter((nav) => {
      const navDate = new Date(nav.date);
      return navDate >= startDate && navDate <= endDate;
    });

    // 如果数据库中没有数据，从 API 同步
    if (filteredNavs.length === 0) {
      await this.syncHistoricalNav(fundCode, startDate, endDate);

      // 同步后重新查询
      navs = await this.fundNavRepository.find({
        where: {
          fund_code: fundCode,
        },
        order: { date: 'ASC' },
      });

      // 再次过滤日期范围
      return navs.filter((nav) => {
        const navDate = new Date(nav.date);
        return navDate >= startDate && navDate <= endDate;
      });
    }

    return filteredNavs;
  }

  /**
   * 同步历史净值数据
   *
   * 从外部 API 获取历史净值数据并批量保存到数据库。
   * 使用 upsert 操作避免重复插入。
   *
   * @param fundCode 基金代码
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @throws Error 如果同步失败
   *
   * @example
   * // 同步2023年全年的历史数据
   * await fundDataService.syncHistoricalNav(
   *   '000001',
   *   new Date('2023-01-01'),
   *   new Date('2023-12-31')
   * );
   */
  async syncHistoricalNav(fundCode: string, startDate: Date, endDate: Date): Promise<void> {
    try {
      console.log(
        `Starting to sync historical nav for ${fundCode} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
      );

      // 从 API 获取历史数据
      const historicalData = await this.fetchHistoricalNavFromApi(fundCode, startDate, endDate);

      console.log(`Fetched ${historicalData.length} records from API`);

      if (historicalData.length > 0) {
        // 批量插入，使用 upsert 避免重复
        // upsert: 如果记录已存在则更新，不存在则插入
        for (const data of historicalData) {
          await this.fundNavRepository.upsert(
            {
              fund_code: fundCode,
              nav: data.nav,
              acc_nav: data.accNav,
              date: data.date,
              growth_rate: data.growthRate,
            },
            ['fund_code', 'date'], // 唯一键：基金代码 + 日期
          );
        }
        console.log(`Synced ${historicalData.length} historical nav records for fund ${fundCode}`);
      } else {
        console.warn(`No historical data fetched from API for ${fundCode}`);
      }
    } catch (error) {
      console.error(`Failed to sync historical nav for ${fundCode}:`, error);
      throw error;
    }
  }

  /**
   * 同步所有基金的最新净值
   *
   * 遍历数据库中的所有基金，获取并更新最新净值。
   * 用于定时任务，每天自动同步净值数据。
   *
   * @example
   * // 定时任务中调用
   * await fundDataService.syncAllFundNav();
   */
  async syncAllFundNav(): Promise<void> {
    // 获取所有基金
    const funds = await this.fundRepository.find();

    // 逐个同步净值
    for (const fund of funds) {
      try {
        await this.getFundNav(fund.code);
      } catch (error) {
        // 单个基金失败不影响其他基金
        console.error(`Failed to sync nav for fund ${fund.code}:`, error);
      }
    }
  }

  /**
   * 从 API 获取基金基本信息
   *
   * 从东方财富网站获取基金的基本信息。
   * 当前为简化实现，实际应该解析 HTML 提取真实数据。
   *
   * @param fundCode 基金代码
   * @returns 基金信息
   * @private
   */
  private async fetchFundInfoFromApi(fundCode: string): Promise<FundInfo> {
    try {
      // 从东方财富API获取基金信息
      const url = `https://fund.eastmoney.com/${fundCode}.html`;
      await axios.get(url, { timeout: 10000 });

      // 简化实现：实际需要解析HTML提取真实数据
      // TODO: 实现完整的 HTML 解析逻辑
      return {
        code: fundCode,
        name: `基金${fundCode}`,
        type: '混合型',
        manager: '未知',
      };
    } catch (error) {
      console.error(`Failed to fetch fund info for ${fundCode}:`, error);
      // 失败时返回默认值
      return {
        code: fundCode,
        name: `基金${fundCode}`,
      };
    }
  }

  /**
   * 从 API 获取实时净值
   *
   * 从天天基金 API 获取基金的实时净值数据。
   * API 返回 JSONP 格式，需要解析提取 JSON 数据。
   *
   * @param fundCode 基金代码
   * @param date 查询日期
   * @returns 净值数据，如果获取失败返回 null
   * @private
   */
  private async fetchNavFromApi(fundCode: string, date: Date): Promise<NavData | null> {
    try {
      // 从天天基金API获取实时净值
      const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js`;
      const response = await axios.get(url, { timeout: 10000 });

      // 解析JSONP响应
      // 响应格式：jsonpgz({...})
      const jsonpData = response.data;
      const jsonMatch = jsonpData.match(/jsonpgz\((.*)\)/);

      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        return {
          nav: parseFloat(data.dwjz || data.gsz), // dwjz: 单位净值, gsz: 估算净值
          accNav: parseFloat(data.ljjz || data.gsz), // ljjz: 累计净值
          date: new Date(data.gztime || date), // gztime: 估值时间
          growthRate: parseFloat(data.gszzl || 0), // gszzl: 估算增长率
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch nav for ${fundCode}:`, error);
      return null;
    }
  }

  /**
   * 从 API 获取历史净值数据
   *
   * 从东方财富 API 分页获取历史净值数据。
   * 支持大量数据的分页加载，自动处理多页数据。
   *
   * @param fundCode 基金代码
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 历史净值数据数组
   * @throws Error 如果获取失败
   * @private
   */
  private async fetchHistoricalNavFromApi(
    fundCode: string,
    startDate: Date,
    endDate: Date,
  ): Promise<NavData[]> {
    try {
      const navData: NavData[] = [];
      let pageIndex = 1;
      const pageSize = 100;
      let hasMore = true;

      // 分页获取数据
      while (hasMore) {
        const url = `http://api.fund.eastmoney.com/f10/lsjz?fundcode=${fundCode}&pageIndex=${pageIndex}&pageSize=${pageSize}`;
        const response = await axios.get(url, { timeout: 15000 });

        if (response.data && response.data.Data && response.data.Data.LSJZList) {
          const records = response.data.Data.LSJZList;

          for (const record of records) {
            const recordDate = new Date(record.FSRQ);

            // 只保存在日期范围内的数据
            if (recordDate >= startDate && recordDate <= endDate) {
              navData.push({
                nav: parseFloat(record.DWJZ), // DWJZ: 单位净值
                accNav: parseFloat(record.LJJZ), // LJJZ: 累计净值
                date: recordDate,
                growthRate: parseFloat(record.JZZZL || 0), // JZZZL: 净值增长率
              });
            }

            // 如果记录日期早于开始日期，停止获取
            if (recordDate < startDate) {
              hasMore = false;
              break;
            }
          }

          // 如果返回的记录数少于页大小，说明没有更多数据
          if (records.length < pageSize) {
            hasMore = false;
          } else {
            pageIndex++;
          }
        } else {
          hasMore = false;
        }
      }

      return navData;
    } catch (error) {
      console.error(`Failed to fetch historical nav for ${fundCode}:`, error);
      throw error;
    }
  }
}

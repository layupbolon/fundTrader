import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Fund, FundNav } from '../../models';
import { formatDate } from '../../utils';

interface FundInfo {
  code: string;
  name: string;
  type?: string;
  manager?: string;
}

interface NavData {
  nav: number;
  accNav: number;
  date: Date;
  growthRate?: number;
}

@Injectable()
export class FundDataService {
  constructor(
    @InjectRepository(Fund)
    private fundRepository: Repository<Fund>,
    @InjectRepository(FundNav)
    private fundNavRepository: Repository<FundNav>,
  ) {}

  async getFundInfo(fundCode: string): Promise<Fund> {
    let fund = await this.fundRepository.findOne({ where: { code: fundCode } });

    if (!fund) {
      // 从天天基金API获取基金信息
      const info = await this.fetchFundInfoFromApi(fundCode);
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

  async getFundNav(fundCode: string, date?: Date): Promise<FundNav | null> {
    const queryDate = date || new Date();
    const dateStr = formatDate(queryDate);

    let nav = await this.fundNavRepository.findOne({
      where: { fund_code: fundCode, date: dateStr as any },
    });

    if (!nav) {
      // 从API获取净值
      const navData = await this.fetchNavFromApi(fundCode, queryDate);
      if (navData) {
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

  async getHistoricalNav(fundCode: string, startDate: Date, endDate: Date): Promise<FundNav[]> {
    const navs = await this.fundNavRepository.find({
      where: {
        fund_code: fundCode,
      },
      order: { date: 'ASC' },
    });

    // 过滤日期范围
    return navs.filter((nav) => {
      const navDate = new Date(nav.date);
      return navDate >= startDate && navDate <= endDate;
    });
  }

  async syncAllFundNav(): Promise<void> {
    const funds = await this.fundRepository.find();

    for (const fund of funds) {
      try {
        await this.getFundNav(fund.code);
      } catch (error) {
        console.error(`Failed to sync nav for fund ${fund.code}:`, error);
      }
    }
  }

  private async fetchFundInfoFromApi(fundCode: string): Promise<FundInfo> {
    try {
      // 从东方财富API获取基金信息
      const url = `https://fund.eastmoney.com/${fundCode}.html`;
      await axios.get(url, { timeout: 10000 });

      // 简化实现：实际需要解析HTML
      return {
        code: fundCode,
        name: `基金${fundCode}`,
        type: '混合型',
        manager: '未知',
      };
    } catch (error) {
      console.error(`Failed to fetch fund info for ${fundCode}:`, error);
      return {
        code: fundCode,
        name: `基金${fundCode}`,
      };
    }
  }

  private async fetchNavFromApi(fundCode: string, date: Date): Promise<NavData | null> {
    try {
      // 从天天基金API获取实时净值
      const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js`;
      const response = await axios.get(url, { timeout: 10000 });

      // 解析JSONP响应
      const jsonpData = response.data;
      const jsonMatch = jsonpData.match(/jsonpgz\((.*)\)/);

      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);
        return {
          nav: parseFloat(data.dwjz || data.gsz),
          accNav: parseFloat(data.ljjz || data.gsz),
          date: new Date(data.gztime || date),
          growthRate: parseFloat(data.gszzl || 0),
        };
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch nav for ${fundCode}:`, error);
      return null;
    }
  }
}

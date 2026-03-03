import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BlacklistType, BlacklistReason } from './enums';

/**
 * 基金黑名单实体
 *
 * 存储被禁止交易的基金、基金经理或基金公司。
 * 用于风险控制，避免投资高风险或不合适的标的。
 *
 * 黑名单类型：
 * - FUND_CODE: 具体基金代码黑名单（如某只基金）
 * - FUND_MANAGER: 基金经理黑名单（该经理管理的所有基金）
 * - FUND_COMPANY: 基金公司黑名单（该公司所有基金）
 *
 * 黑名单原因：
 * - POOR_PERFORMANCE: 业绩持续不佳
 * - MANAGER_CHANGE: 基金经理变更
 * - INAPPROPRIATE_SIZE: 基金规模过大或过小
 * - STYLE_DRIFT: 投资风格漂移
 * - HIGH_RISK_INDUSTRY: 高风险行业
 * - REGULATORY_PENALTY: 监管处罚
 * - LIQUIDITY_RISK: 流动性风险
 * - OTHER: 其他原因
 *
 * 检查机制：
 * - 创建策略时检查：黑名单基金无法创建策略
 * - 交易前检查：黑名单基金无法创建交易订单
 * - 定期检查：持仓基金被加入黑名单时告警
 */
@Entity('blacklist')
export class Blacklist {
  /**
   * 黑名单记录唯一标识符
   * 使用 UUID 格式，自动生成
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 黑名单类型
   * - FUND_CODE: 基金代码黑名单
   * - FUND_MANAGER: 基金经理黑名单
   * - FUND_COMPANY: 基金公司黑名单
   */
  @Column({ type: 'enum', enum: BlacklistType })
  type: BlacklistType;

  /**
   * 黑名单值
   *
   * 根据类型不同含义不同：
   * - FUND_CODE: 基金代码（如 "000001"）
   * - FUND_MANAGER: 基金经理姓名
   * - FUND_COMPANY: 基金公司名称
   */
  @Column()
  value: string;

  /**
   * 黑名单原因
   * 记录被列入黑名单的原因
   */
  @Column({ type: 'enum', enum: BlacklistReason })
  reason: BlacklistReason;

  /**
   * 备注信息
   * 详细的说明或备注
   */
  @Column({ type: 'text', nullable: true })
  note: string;

  /**
   * 启用状态
   * - true: 黑名单启用，会进行检查和拦截
   * - false: 黑名单暂停，不会检查
   *
   * 用途：
   * - 临时移除限制而不删除记录
   * - 观察后重新评估
   */
  @Column({ default: true })
  enabled: boolean;

  /**
   * 过期时间
   * 黑名单自动失效时间，null 表示永久有效
   */
  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  /**
   * 创建时间
   * 自动记录创建时间
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * 最后更新时间
   * 自动记录最后修改时间
   */
  @UpdateDateColumn()
  updated_at: Date;

  /**
   * 检查是否在黑名单中
   *
   * @param target 要检查的目标值（基金代码、经理姓名、公司名称）
   * @returns true 表示在黑名单中，false 表示不在
   */
  isBlacklisted(target: string): boolean {
    if (!this.enabled) {
      return false;
    }

    // 检查是否已过期
    if (this.expires_at && new Date() > this.expires_at) {
      return false;
    }

    return this.value === target;
  }

  /**
   * 检查是否已过期
   *
   * @returns true 表示已过期，false 表示未过期
   */
  isExpired(): boolean {
    if (!this.expires_at) {
      return false;
    }
    return new Date() > this.expires_at;
  }
}

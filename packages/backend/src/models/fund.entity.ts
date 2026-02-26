import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * 基金实体
 *
 * 存储基金的基本信息，包括基金代码、名称、类型和基金经理。
 * 基金代码作为主键，与其他表（净值、持仓、交易）建立关联。
 *
 * 数据来源：
 * - 从天天基金 API 获取基金基本信息
 * - 定期同步更新基金信息
 */
@Entity('funds')
export class Fund {
  /**
   * 基金代码
   * 6位数字，如 "000001"（华夏成长）
   * 作为主键，全局唯一标识一只基金
   */
  @PrimaryColumn()
  code: string;

  /**
   * 基金名称
   * 如 "华夏成长混合"
   */
  @Column()
  name: string;

  /**
   * 基金类型
   * 如 "混合型"、"股票型"、"债券型"、"货币型"等
   * 可选字段，用于基金分类和筛选
   */
  @Column({ nullable: true })
  type: string;

  /**
   * 基金经理
   * 当前管理该基金的基金经理姓名
   * 可选字段，用于跟踪基金经理变更
   */
  @Column({ nullable: true })
  manager: string;

  /**
   * 最后更新时间
   * 自动记录基金信息的最后更新时间
   */
  @UpdateDateColumn()
  updated_at: Date;
}

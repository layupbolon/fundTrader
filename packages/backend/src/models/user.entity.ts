import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * 用户实体
 *
 * 存储系统用户的基本信息和加密的交易平台凭证。
 * 每个用户可以配置多个交易策略和持有多个基金仓位。
 *
 * 安全说明：
 * - 交易平台的账号密码使用 AES-256-GCM 加密后存储在 encrypted_credentials 字段
 * - 加密密钥通过环境变量 MASTER_KEY 配置，不存储在数据库中
 */
@Entity('users')
export class User {
  /**
   * 用户唯一标识符
   * 使用 UUID 格式，自动生成
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * 用户名
   * 全局唯一，用于标识用户身份
   */
  @Column({ unique: true })
  username: string;

  /**
   * 加密的交易平台凭证
   *
   * 存储格式（加密前）：
   * {
   *   tiantian: {
   *     username: string,  // 天天基金账号
   *     password: string   // 天天基金密码
   *   }
   * }
   *
   * 使用 AES-256-GCM 算法加密，包含：
   * - iv: 初始化向量（16字节）
   * - authTag: 认证标签（16字节）
   * - encrypted: 加密后的数据
   */
  @Column({ type: 'jsonb', nullable: true })
  encrypted_credentials: any;

  /**
   * 创建时间
   * 自动记录用户注册时间
   */
  @CreateDateColumn()
  created_at: Date;
}

import * as crypto from 'crypto';

/**
 * 加密工具类
 *
 * 使用 AES-256-GCM 算法加密和解密敏感数据。
 * GCM (Galois/Counter Mode) 是一种认证加密模式，提供数据的机密性和完整性保护。
 *
 * 安全特性：
 * - AES-256: 使用 256 位密钥，提供高强度加密
 * - GCM 模式: 同时提供加密和认证，防止数据被篡改
 * - 随机 IV: 每次加密使用不同的初始化向量，确保相同明文产生不同密文
 * - 认证标签: 用于验证数据完整性，防止中间人攻击
 *
 * 使用场景：
 * - 加密存储交易平台账号密码
 * - 加密存储 API 密钥和令牌
 * - 加密存储其他敏感配置信息
 *
 * 密钥管理：
 * - MASTER_KEY: 主密钥，通过环境变量配置，不存储在代码中
 * - ENCRYPTION_SALT: 盐值，用于从主密钥派生加密密钥
 * - 使用 scrypt 算法从主密钥派生 32 字节密钥
 *
 * 注意事项：
 * - 生产环境必须使用强随机密钥（至少 32 字符）
 * - 定期轮换密钥
 * - 不要将密钥提交到版本控制
 * - 备份加密数据前先备份密钥
 *
 * @example
 * const cryptoUtil = new CryptoUtil(process.env.MASTER_KEY);
 * const encrypted = cryptoUtil.encrypt('sensitive data');
 * const decrypted = cryptoUtil.decrypt(encrypted);
 */
export class CryptoUtil {
  /**
   * 加密算法
   * AES-256-GCM: 高级加密标准，256位密钥，GCM认证加密模式
   */
  private algorithm = 'aes-256-gcm';

  /**
   * 加密密钥
   * 从主密钥和盐值派生的 32 字节密钥
   */
  private key: Buffer;

  /**
   * 构造函数
   *
   * 从主密钥派生加密密钥。使用 scrypt 算法确保密钥强度。
   *
   * @param masterKey 主密钥，至少 32 字符
   * @throws Error 如果 ENCRYPTION_SALT 环境变量未设置或长度不足
   *
   * @example
   * const cryptoUtil = new CryptoUtil(process.env.MASTER_KEY);
   */
  constructor(masterKey: string) {
    const salt = process.env.ENCRYPTION_SALT;
    if (!salt || salt.length < 16) {
      throw new Error('ENCRYPTION_SALT environment variable must be at least 16 characters');
    }
    // 使用 scrypt 从主密钥派生 32 字节密钥
    // scrypt 是一种内存密集型密钥派生函数，可以抵抗暴力破解
    this.key = crypto.scryptSync(masterKey, salt, 32);
  }

  /**
   * 加密文本
   *
   * 使用 AES-256-GCM 算法加密文本，返回包含 IV、密文和认证标签的 JSON 字符串。
   *
   * 加密流程：
   * 1. 生成随机 IV（初始化向量）
   * 2. 创建加密器
   * 3. 加密明文
   * 4. 获取认证标签
   * 5. 返回 JSON 格式的加密数据
   *
   * @param text 待加密的明文
   * @returns JSON 字符串，包含 iv、encrypted、authTag 三个字段
   *
   * @example
   * const encrypted = cryptoUtil.encrypt('my password');
   * // 返回: {"iv":"...","encrypted":"...","authTag":"..."}
   */
  encrypt(text: string): string {
    // 生成随机 IV（16 字节）
    // 每次加密使用不同的 IV，确保相同明文产生不同密文
    const iv = crypto.randomBytes(16);

    // 创建加密器
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

    // 加密明文
    // 输入 utf8 编码的文本，输出 hex 编码的密文
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // 获取认证标签（16 字节）
    // 用于验证数据完整性，防止篡改
    const authTag = cipher.getAuthTag();

    // 返回 JSON 格式的加密数据
    // 包含 IV、密文和认证标签，解密时需要这三个值
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex'),
    });
  }

  /**
   * 解密文本
   *
   * 使用 AES-256-GCM 算法解密文本，验证数据完整性。
   *
   * 解密流程：
   * 1. 解析 JSON 获取 IV、密文和认证标签
   * 2. 创建解密器
   * 3. 设置认证标签
   * 4. 解密密文
   * 5. 返回明文
   *
   * @param encryptedData JSON 字符串，包含 iv、encrypted、authTag
   * @returns 解密后的明文
   * @throws Error 如果认证标签验证失败（数据被篡改）
   *
   * @example
   * const decrypted = cryptoUtil.decrypt(encrypted);
   * // 返回: 'my password'
   */
  decrypt(encryptedData: string): string {
    // 解析 JSON 获取加密数据的各个部分
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);

    // 创建解密器
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    ) as crypto.DecipherGCM;

    // 设置认证标签
    // 解密时会验证标签，如果数据被篡改会抛出异常
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    // 解密密文
    // 输入 hex 编码的密文，输出 utf8 编码的明文
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

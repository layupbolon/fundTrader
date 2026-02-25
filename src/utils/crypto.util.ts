import * as crypto from 'crypto';

export class CryptoUtil {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor(masterKey: string) {
    const salt = process.env.ENCRYPTION_SALT;
    if (!salt || salt.length < 16) {
      throw new Error('ENCRYPTION_SALT environment variable must be at least 16 characters');
    }
    this.key = crypto.scryptSync(masterKey, salt, 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex'),
    });
  }

  decrypt(encryptedData: string): string {
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    ) as crypto.DecipherGCM;

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

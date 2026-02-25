import { CryptoUtil } from '../crypto.util';

describe('CryptoUtil', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENCRYPTION_SALT = 'test_salt_min_16_chars';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create instance with valid master key and salt', () => {
      expect(() => new CryptoUtil('test_master_key_min_32_characters')).not.toThrow();
    });

    it('should throw error if ENCRYPTION_SALT is not set', () => {
      delete process.env.ENCRYPTION_SALT;
      expect(() => new CryptoUtil('test_master_key')).toThrow(
        'ENCRYPTION_SALT environment variable must be at least 16 characters',
      );
    });

    it('should throw error if ENCRYPTION_SALT is too short', () => {
      process.env.ENCRYPTION_SALT = 'short';
      expect(() => new CryptoUtil('test_master_key')).toThrow(
        'ENCRYPTION_SALT environment variable must be at least 16 characters',
      );
    });
  });

  describe('encrypt and decrypt', () => {
    let cryptoUtil: CryptoUtil;

    beforeEach(() => {
      cryptoUtil = new CryptoUtil('test_master_key_min_32_characters');
    });

    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'sensitive_password_123';
      const encrypted = cryptoUtil.encrypt(plaintext);
      const decrypted = cryptoUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'test_data';
      const encrypted1 = cryptoUtil.encrypt(plaintext);
      const encrypted2 = cryptoUtil.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should encrypt empty string', () => {
      const plaintext = '';
      const encrypted = cryptoUtil.encrypt(plaintext);
      const decrypted = cryptoUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt unicode characters', () => {
      const plaintext = '中文密码123!@#';
      const encrypted = cryptoUtil.encrypt(plaintext);
      const decrypted = cryptoUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt long text', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = cryptoUtil.encrypt(plaintext);
      const decrypted = cryptoUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce valid JSON structure', () => {
      const plaintext = 'test';
      const encrypted = cryptoUtil.encrypt(plaintext);
      const parsed = JSON.parse(encrypted);

      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('authTag');
    });

    it('should fail to decrypt with wrong key', () => {
      const plaintext = 'secret';
      const encrypted = cryptoUtil.encrypt(plaintext);

      const wrongCrypto = new CryptoUtil('wrong_master_key_min_32_characters');
      expect(() => wrongCrypto.decrypt(encrypted)).toThrow();
    });

    it('should fail to decrypt tampered data', () => {
      const plaintext = 'secret';
      const encrypted = cryptoUtil.encrypt(plaintext);
      const parsed = JSON.parse(encrypted);

      parsed.encrypted = parsed.encrypted.slice(0, -2) + 'ff';
      const tampered = JSON.stringify(parsed);

      expect(() => cryptoUtil.decrypt(tampered)).toThrow();
    });
  });

  describe('key derivation', () => {
    it('should derive different keys for different master keys', () => {
      const crypto1 = new CryptoUtil('master_key_1_min_32_characters_long');
      const crypto2 = new CryptoUtil('master_key_2_min_32_characters_long');

      const plaintext = 'test';
      const encrypted1 = crypto1.encrypt(plaintext);

      expect(() => crypto2.decrypt(encrypted1)).toThrow();
    });

    it('should derive same key for same master key', () => {
      const masterKey = 'consistent_master_key_min_32_chars';
      const crypto1 = new CryptoUtil(masterKey);
      const crypto2 = new CryptoUtil(masterKey);

      const plaintext = 'test';
      const encrypted = crypto1.encrypt(plaintext);
      const decrypted = crypto2.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});

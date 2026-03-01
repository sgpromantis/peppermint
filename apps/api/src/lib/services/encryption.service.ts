import crypto from "crypto";
import { prisma } from "../../prisma";

/**
 * Encryption service for sensitive credentials
 * 
 * Uses AES-256-CBC encryption with per-instance encryption keys stored in the Config table.
 * This ensures that even if the database is compromised, credentials remain encrypted.
 */
export class EncryptionService {
  private static encryptionKey: Buffer | null = null;

  /**
   * Initialize or get the encryption key
   * Creates a new key if one doesn't exist
   */
  static async initializeKey(): Promise<Buffer> {
    // Return cached key if already loaded
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    try {
      const config = await prisma.config.findFirst();

      if (config?.encryption_key) {
        this.encryptionKey = config.encryption_key;
        return this.encryptionKey;
      }

      // Generate new encryption key if it doesn't exist
      const newKey = crypto.randomBytes(32); // 256-bit key for AES-256

      const updatedConfig = await prisma.config.update({
        where: { id: config?.id || (await this.getOrCreateConfig()).id },
        data: { encryption_key: newKey },
      });

      this.encryptionKey = updatedConfig.encryption_key!;
      return this.encryptionKey;
    } catch (error) {
      console.error("Error initializing encryption key:", error);
      throw new Error("Failed to initialize encryption key");
    }
  }

  /**
   * Get or create the Config record
   */
  private static async getOrCreateConfig() {
    let config = await prisma.config.findFirst();

    if (!config) {
      config = await prisma.config.create({
        data: {
          first_time_setup: true,
        },
      });
    }

    return config;
  }

  /**
   * Encrypt a string value
   * @param plaintext The value to encrypt
   * @returns Encrypted string in format: iv:encryptedData (both hex-encoded)
   */
  static async encrypt(plaintext: string): Promise<string> {
    try {
      const key = await this.initializeKey();

      // Generate a random IV for each encryption
      const iv = crypto.randomBytes(16);

      // Create cipher (cast key to any to handle type compatibility)
      const cipher = crypto.createCipheriv("aes-256-cbc", key as any, iv as any);

      // Encrypt
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Return IV and encrypted data together (IV is not secret, just needs to be unique per encryption)
      return `${iv.toString("hex")}:${encrypted}`;
    } catch (error) {
      console.error("Encryption error:", error);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypt a string value
   * @param encryptedText Encrypted string in format: iv:encryptedData
   * @returns Decrypted plaintext
   */
  static async decrypt(encryptedText: string): Promise<string> {
    try {
      if (!encryptedText || !encryptedText.includes(":")) {
        // Not encrypted (legacy data)
        return encryptedText;
      }

      const key = await this.initializeKey();

      // Split IV and encrypted data
      const [ivHex, encrypted] = encryptedText.split(":");
      const iv = Buffer.from(ivHex, "hex");

      // Create decipher (cast key to any to handle type compatibility)
      const decipher = crypto.createDecipheriv("aes-256-cbc", key as any, iv as any);

      // Decrypt
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("Decryption error:", error);
      throw new Error("Failed to decrypt data");
    }
  }

  /**
   * Clear cached key (useful for testing or key rotation)
   */
  static clearCache(): void {
    this.encryptionKey = null;
  }

  /**
   * Rotate encryption key
   * Re-encrypts all stored credentials with new key
   * WARNING: This is a heavy operation, should be done during maintenance window
   */
  static async rotateKey(): Promise<{ success: boolean; encrypted: number }> {
    try {
      const oldKey = await this.initializeKey();
      const newKey = crypto.randomBytes(32);

      // Get config records with encrypted credentials
      const configs = await prisma.config.findMany({
        where: {
          OR: [
            { ms_graph_client_secret: { not: null } },
            { ms_graph_client_id: { not: null } },
          ],
        },
      });

      let encryptedCount = 0;

      // Re-encrypt each credential with new key
      for (const config of configs) {
        const updates: any = {};

        // Decrypt with old key, encrypt with new key
        if (config.ms_graph_client_id) {
          const decrypted = await this.decrypt(config.ms_graph_client_id);
          this.encryptionKey = newKey;
          updates.ms_graph_client_id = await this.encrypt(decrypted);
          encryptedCount++;
        }

        if (config.ms_graph_client_secret) {
          const decrypted = await this.decrypt(config.ms_graph_client_secret);
          this.encryptionKey = newKey;
          updates.ms_graph_client_secret = await this.encrypt(decrypted);
          encryptedCount++;
        }

        if (config.ms_graph_tenant_id) {
          const decrypted = await this.decrypt(config.ms_graph_tenant_id);
          this.encryptionKey = newKey;
          updates.ms_graph_tenant_id = await this.encrypt(decrypted);
          encryptedCount++;
        }

        // Update config with new encrypted values
        if (Object.keys(updates).length > 0) {
          updates.encryption_key = newKey;
          await prisma.config.update({
            where: { id: config.id },
            data: updates,
          });
        }
      }

      this.clearCache();
      return { success: true, encrypted: encryptedCount };
    } catch (error) {
      console.error("Key rotation error:", error);
      throw new Error("Failed to rotate encryption key");
    }
  }
}

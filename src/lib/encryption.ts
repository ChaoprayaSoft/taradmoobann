import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = process.env.NEXTAUTH_SECRET || 'default_fallback_secret_key_please_change';

// Generate a valid 32-byte key from the secret
const key = crypto.createHash('sha256').update(String(SECRET_KEY)).digest('base64').substring(0, 32);

export function encryptAddress(text: string): string {
  try {
    if (!text || text.startsWith("ENC:")) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return `ENC:${iv.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (error) {
    console.error("Encryption error:", error);
    return text;
  }
}

export function decryptAddress(encryptedText: string): string {
  try {
    if (!encryptedText || !encryptedText.startsWith("ENC:")) return encryptedText;
    const parts = encryptedText.substring(4).split(':');
    if (parts.length !== 2) return encryptedText;
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedTextBuffer = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv);
    let decrypted = decipher.update(encryptedTextBuffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error("Decryption error:", error);
    return encryptedText;
  }
}

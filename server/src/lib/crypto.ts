import crypto from "node:crypto";

const SALT = Buffer.from("rtpg-v1-hkdf-salt", "utf8");
const INFO = Buffer.from("rtpg-aes256gcm", "utf8");

function getDerivedKey(): Buffer {
  const material = process.env.ENCRYPTION_KEY ?? process.env.JWT_SECRET;
  if (!material) {
    throw new Error(
      "[crypto] Nenhuma chave de criptografia encontrada. " +
      "Defina a variÃ¡vel de ambiente ENCRYPTION_KEY antes de iniciar o servidor."
    );
  }
  if (!process.env.ENCRYPTION_KEY && process.env.JWT_SECRET) {
    console.warn(
      "[crypto] AVISO: usando JWT_SECRET como chave de criptografia. " +
      "Defina ENCRYPTION_KEY para maior seguranÃ§a."
    );
  }
  // HKDF Ã© mais seguro que SHA-256 simples: usa salt e info para derivaÃ§Ã£o resistente a colisÃµes
  return crypto.hkdfSync("sha256", material, SALT, INFO, 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  if (!isEncrypted(ciphertext)) return ciphertext;
  const key = getDerivedKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 4) throw new Error("[crypto] Formato de ciphertext invÃ¡lido.");
  const [, ivHex, tagHex, encHex] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith("enc:");
}

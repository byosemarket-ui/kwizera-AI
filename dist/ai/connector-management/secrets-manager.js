import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
/** Encrypts local credentials; callers supply the runtime-only master passphrase. */
export class AiSecretsManager {
    root = "";
    passphrase;
    secrets = new Map();
    async initialize(storageRoot, passphrase = process.env.KWIZERA_SECRETS_PASSPHRASE) {
        this.root = path.join(storageRoot, "connector-management");
        this.passphrase = passphrase;
        await fs.mkdir(this.root, { recursive: true });
        await this.restore();
    }
    isUnlocked() { return Boolean(this.passphrase); }
    async set(secretId, value) {
        if (!secretId.trim() || !value)
            throw new Error("Secret id and value are required");
        const now = new Date().toISOString();
        const salt = randomBytes(16);
        const iv = randomBytes(12);
        const key = this.key(salt);
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
        this.secrets.set(secretId, { id: secretId, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64"), createdAt: this.secrets.get(secretId)?.createdAt ?? now, updatedAt: now });
        await this.persist();
    }
    async remove(secretId) { this.secrets.delete(secretId); await this.persist(); }
    has(secretId) { return this.secrets.has(secretId); }
    get(secretId) {
        const secret = this.secrets.get(secretId);
        if (!secret)
            throw new Error(`Secret not found: ${secretId}`);
        const decipher = createDecipheriv("aes-256-gcm", this.key(Buffer.from(secret.salt, "base64")), Buffer.from(secret.iv, "base64"));
        decipher.setAuthTag(Buffer.from(secret.tag, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, "base64")), decipher.final()]).toString("utf8");
    }
    key(salt) { if (!this.passphrase)
        throw new Error("Secrets Manager is locked; set KWIZERA_SECRETS_PASSPHRASE before using authenticated connectors"); return scryptSync(this.passphrase, salt, 32); }
    async restore() { try {
        const saved = JSON.parse(await fs.readFile(path.join(this.root, "secrets.json"), "utf8"));
        for (const secret of saved)
            this.secrets.set(secret.id, secret);
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    } }
    async persist() { const target = path.join(this.root, "secrets.json"); const temporary = `${target}.${randomBytes(8).toString("hex")}.tmp`; await fs.writeFile(temporary, `${JSON.stringify([...this.secrets.values()])}\n`, "utf8"); await fs.rename(temporary, target); }
}
//# sourceMappingURL=secrets-manager.js.map
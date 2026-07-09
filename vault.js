/**
 * CYPHERPUNK_WARS: ENCRYPTED_VAULT
 * vault.js
 *
 * Password-based local keystore for the operator's mnemonic, using native Web
 * Crypto (PBKDF2 + AES-GCM) -- the same pattern used by MetaMask, Phantom, and
 * essentially every browser wallet. Lets a session resume across browser
 * restarts with a short password instead of re-entering the full 24-word
 * phrase every time, while the mnemonic stays encrypted at rest in
 * localStorage -- only ever decrypted transiently, in memory.
 */

const VAULT_STORAGE_KEY = 'bunker_vault';
const PBKDF2_ITERATIONS = 300000;

function bufToBase64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function base64ToBuf(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}

async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export function hasVault() {
    return localStorage.getItem(VAULT_STORAGE_KEY) !== null;
}

export async function createVault(mnemonicPhrase, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode(mnemonicPhrase)
    );
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify({
        salt: bufToBase64(salt),
        iv: bufToBase64(iv),
        ciphertext: bufToBase64(ciphertext),
    }));
}

// Returns the decrypted mnemonic phrase, or throws INVALID_PASSWORD (AES-GCM's
// built-in authentication tag check fails on a wrong password -- no separate
// MAC/verification step needed) or NO_VAULT if none exists on this device.
export async function unlockVault(password) {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) throw new Error('NO_VAULT');

    const { salt, iv, ciphertext } = JSON.parse(raw);
    const key = await deriveKey(password, base64ToBuf(salt));
    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToBuf(iv) }, key, base64ToBuf(ciphertext)
        );
        return new TextDecoder().decode(plaintext);
    } catch (err) {
        throw new Error('INVALID_PASSWORD');
    }
}

export function clearVault() {
    localStorage.removeItem(VAULT_STORAGE_KEY);
}

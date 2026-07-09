/**
 * CYPHERPUNK_WARS: ENCRYPTED_VAULT
 * vault.js
 *
 * Password-based local keystore for operator mnemonics, using native Web
 * Crypto (PBKDF2 + AES-GCM) -- the same pattern used by MetaMask, Phantom, and
 * essentially every browser wallet. Lets a session resume across browser
 * restarts with a short password instead of re-entering the full 24-word
 * phrase every time, while the mnemonic stays encrypted at rest in
 * localStorage -- only ever decrypted transiently, in memory.
 *
 * Supports MULTIPLE identities on one device/browser (each address gets its
 * own encrypted entry, own password) so creating or importing a new identity
 * never silently destroys a previously-saved one.
 */

const VAULTS_STORAGE_KEY = 'bunker_vaults';
const LEGACY_SINGLE_VAULT_KEY = 'bunker_vault'; // pre-multi-account format, migrated on first read
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

// Migrates the old single-vault format (one global vault, implicitly tied to
// whatever address was active when it was created) into the new
// address-keyed format. Runs once; the legacy key is removed after.
function loadVaults() {
    const raw = localStorage.getItem(VAULTS_STORAGE_KEY);
    const vaults = raw ? JSON.parse(raw) : {};

    const legacyRaw = localStorage.getItem(LEGACY_SINGLE_VAULT_KEY);
    if (legacyRaw) {
        const legacyAddress = localStorage.getItem('bunker_id');
        if (legacyAddress && !vaults[legacyAddress]) {
            vaults[legacyAddress] = JSON.parse(legacyRaw);
            localStorage.setItem(VAULTS_STORAGE_KEY, JSON.stringify(vaults));
        }
        localStorage.removeItem(LEGACY_SINGLE_VAULT_KEY);
    }

    return vaults;
}

function saveVaults(vaults) {
    localStorage.setItem(VAULTS_STORAGE_KEY, JSON.stringify(vaults));
}

export function listVaultAddresses() {
    return Object.keys(loadVaults());
}

export function hasVault(address) {
    return address in loadVaults();
}

export async function createVault(address, mnemonicPhrase, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode(mnemonicPhrase)
    );

    const vaults = loadVaults();
    vaults[address] = {
        salt: bufToBase64(salt),
        iv: bufToBase64(iv),
        ciphertext: bufToBase64(ciphertext),
        createdAt: Date.now(),
    };
    saveVaults(vaults);
}

// Returns the decrypted mnemonic phrase, or throws INVALID_PASSWORD (AES-GCM's
// built-in authentication tag check fails on a wrong password -- no separate
// MAC/verification step needed) or NO_VAULT if this address has no saved vault.
export async function unlockVault(address, password) {
    const vaults = loadVaults();
    const entry = vaults[address];
    if (!entry) throw new Error('NO_VAULT');

    const key = await deriveKey(password, base64ToBuf(entry.salt));
    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: base64ToBuf(entry.iv) }, key, base64ToBuf(entry.ciphertext)
        );
        return new TextDecoder().decode(plaintext);
    } catch (err) {
        throw new Error('INVALID_PASSWORD');
    }
}

export function removeVault(address) {
    const vaults = loadVaults();
    delete vaults[address];
    saveVaults(vaults);
}

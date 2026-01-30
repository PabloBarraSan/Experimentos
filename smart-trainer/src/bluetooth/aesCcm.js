/**
 * AES-256-CCM decryption for Zwift Play protocol
 * NIST SP 800-38C / RFC 3610: 8-byte nonce (L=7), 4-byte tag (M=4)
 * Web Crypto API does not support AES-CCM; decrypt-only using AES-CTR and AES-CBC.
 */

const NONCE_LEN = 8;
const TAG_LEN = 4;
const BLOCK_LEN = 16;

/**
 * Decrypt and verify AES-256-CCM message
 * Zwift format (Makinolo): nonce = last 4 bytes of HKDF key + 4-byte counter from packet; tag = 4 bytes
 * Packet: [counter 4 LE][ciphertext][tag 4]
 *
 * @param {Uint8Array} key - 36 bytes (HKDF output); bytes 32-35 = nonce prefix
 * @param {Uint8Array} packet - full packet: counter(4) || ciphertext || tag(4)
 * @returns {Promise<{ plaintext: Uint8Array, authOk: boolean }>}
 */
export async function decryptAesCcm(key, packet) {
    if (key.length < 36) throw new Error('AES-CCM: key must be at least 36 bytes');
    if (packet.length < 4 + TAG_LEN) throw new Error('AES-CCM: packet too short');

    const counter = packet.subarray(0, 4);
    const ciphertextAndTag = packet.subarray(4);
    const ciphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - TAG_LEN);
    const tagReceived = ciphertextAndTag.subarray(ciphertextAndTag.length - TAG_LEN);

    const noncePrefix = key.subarray(32, 36);
    const nonce = new Uint8Array(NONCE_LEN);
    nonce.set(noncePrefix, 0);
    nonce.set(counter, 4);

    const aesKeyBytes = key.subarray(0, 32);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        aesKeyBytes,
        { name: 'AES-CTR' },
        false,
        ['decrypt']
    );

    const initialCounterBlock = new Uint8Array(16);
    initialCounterBlock[0] = 0x01;
    initialCounterBlock.set(nonce, 1);
    initialCounterBlock[15] = 1;

    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-CTR', counter: initialCounterBlock, length: 128 },
        cryptoKey,
        ciphertext
    ).then((buf) => new Uint8Array(buf));

    const cbcKey = await crypto.subtle.importKey(
        'raw',
        aesKeyBytes,
        { name: 'AES-CBC' },
        false,
        ['encrypt']
    );

    const payloadLen = plaintext.length;
    const B0 = new Uint8Array(16);
    B0[0] = 0x0e;
    B0.set(nonce, 1);
    for (let i = 0; i < 7; i++) B0[15 - i] = (payloadLen >> (i * 8)) & 0xff;

    const numBlocks = 1 + Math.ceil(payloadLen / BLOCK_LEN);
    const macInput = new Uint8Array(numBlocks * BLOCK_LEN);
    macInput.set(B0, 0);
    macInput.set(plaintext, BLOCK_LEN);

    const iv = new Uint8Array(16);
    const macOutput = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        cbcKey,
        macInput
    );
    const tagComputed = new Uint8Array(macOutput).subarray(macOutput.byteLength - BLOCK_LEN, macOutput.byteLength - BLOCK_LEN + TAG_LEN);

    let authOk = true;
    for (let i = 0; i < TAG_LEN; i++) {
        if (tagComputed[i] !== tagReceived[i]) authOk = false;
    }

    return { plaintext, authOk };
}

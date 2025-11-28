const dhive = require('@hiveio/dhive');
const crypto = require('crypto');

/** ***************** CONFIG ****************** */
const API_BASE = process.env.API_BASE || 'http://localhost:8004'; // your backend URL
const USERNAME = process.env.HIVE_USERNAME || 'your-hive-username';
const POSTING_WIF = process.env.HIVE_POSTING_WIF || '5XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // DEBUG ONLY, don't use in prod

// Optional: hive RPC client if you want to sanity-check account keys
const hiveNodes = (process.env.HIVE_RPC_NODES || 'https://api.hive.blog')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);

const hiveClient = new dhive.Client(hiveNodes);
/** ********************************************* */

async function getNonce(username) {
  const url = `${API_BASE}/auth/hive/challenge?username=${encodeURIComponent(username)}`;
  console.log(`\n[1] GET ${url}`);

  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));

  console.log('[1] Status:', res.status);
  console.log('[1] Response:', body);

  if (!res.ok || !body.nonce) {
    throw new Error(`Failed to get nonce: HTTP ${res.status}`);
  }

  return body.nonce;
}

function signNonceWithDhive(nonce, wif) {
  console.log('\n[2] Signing nonce with dhive (posting key)...');
  const privateKey = dhive.PrivateKey.fromString(wif);

  // IMPORTANT: must match backend: Signature.fromString(sig).recover(sha256(nonce))
  const digest = crypto.createHash('sha256')
    .update(nonce, 'utf8')
    .digest();
  const signature = privateKey.sign(digest).toString();

  console.log('[2] Nonce:', nonce);
  console.log('[2] Signature:', signature);

  return signature;
}

async function postLogin(username, nonce, signature) {
  const url = `${API_BASE}/auth/login-keychain`;
  console.log(`\n[3] POST ${url}`);

  const payload = {
    username,
    nonce,
    signature,
    // publicKey is optional and not trusted by backend, but you CAN send it if you want:
    // publicKey: dhive.PrivateKey.fromString(POSTING_WIF).createPublic().toString(),
  };

  console.log('[3] Payload:', payload);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  console.log('[3] Status:', res.status);
  console.log('[3] Response:', body);

  if (!res.ok || !body.token) {
    throw new Error(`Login failed: HTTP ${res.status}`);
  }

  return body.token;
}

async function getMe(token) {
  const url = `${API_BASE}/auth/hive/me`;
  console.log(`\n[4] GET ${url}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await res.json().catch(() => ({}));

  console.log('[4] Status:', res.status);
  console.log('[4] Response:', body);

  if (!res.ok) {
    throw new Error(`Me request failed: HTTP ${res.status}`);
  }

  return body;
}

// Optional helper: sanity-check that your WIF really is a posting key of USERNAME
async function checkPostingKeyMatchesAccount() {
  console.log('\n[0] Optional: checking posting key against blockchain...');
  const [account] = await hiveClient.database.getAccounts([USERNAME]);
  if (!account) throw new Error(`Account ${USERNAME} not found on-chain`);

  const accountPostingKeys = account.posting.key_auths.map((k) => k[0]);

  const pubFromWif = dhive.PrivateKey.fromString(POSTING_WIF).createPublic().toString();

  console.log('[0] Account posting keys:', accountPostingKeys);
  console.log('[0] Public key from WIF:', pubFromWif);

  if (!accountPostingKeys.includes(pubFromWif)) {
    console.warn('[0] WARNING: given WIF does NOT match any posting key of this account!');
  } else {
    console.log('[0] OK: WIF is a valid posting key for this account.');
  }
}

async function main() {
  console.log('=== Hive Keychain-like login debug tool ===');
  console.log('API_BASE:', API_BASE);
  console.log('USERNAME:', USERNAME);

  if (!USERNAME || !POSTING_WIF || POSTING_WIF.startsWith('5XXXX')) {
    console.error('\nPlease set HIVE_USERNAME and HIVE_POSTING_WIF env vars or edit the config block.');
    process.exit(1);
  }

  // Optional check
  await checkPostingKeyMatchesAccount().catch((err) => {
    console.warn('[0] Posting key check failed:', err.message);
  });

  try {
    // 1) Get nonce from backend
    const nonce = await getNonce(USERNAME);

    // 2) Sign nonce with dhive
    const signature = signNonceWithDhive(nonce, POSTING_WIF);

    // 3) Login call
    const token = await postLogin(USERNAME, nonce, signature);

    // 4) /auth/me with JWT
    await getMe(token);

    console.log('\n=== Flow finished successfully ===\n');
  } catch (err) {
    console.error('\n!!! ERROR in flow:', err.message);
    console.error(err);
    process.exit(1);
  }
}

main();

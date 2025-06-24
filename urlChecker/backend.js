const crypto = require('crypto');

const safeHosts = [
  'facebook.com',
  'my.site',
  'example-good.com',
  // ... up to 5000 entries
];

// Normalize domain for consistent hashing
const normalizeDomain = (domain) => domain.toLowerCase().trim();

// Extract base domain (remove subdomains)
const getBaseDomain = (hostname) => {
  const normalized = normalizeDomain(hostname);
  const parts = normalized.split('.');
  if (parts.length <= 2) return normalized;
  return parts.slice(-2).join('.');
};

// Create hash prefix as bytes (not hex string)
const getHashPrefixBytes = (host, prefixLen = 6) => {
  const normalized = normalizeDomain(host);
  const baseDomain = getBaseDomain(normalized);
  const hash = crypto.createHash('sha256').update(baseDomain).digest();
  return hash.slice(0, prefixLen); // Return actual bytes
};

// Generate compact binary data for Redis storage
const generateRedisData = (hosts, prefixLen = 6) => {
  const prefixes = hosts.map((host) => getHashPrefixBytes(host, prefixLen));

  // Convert to base64 for Redis storage
  const buffer = Buffer.concat(prefixes);
  const base64Data = buffer.toString('base64');

  return {
    data: base64Data,
    prefixLength: prefixLen,
    count: hosts.length,
  };
};

// Frontend lookup function (to be used in ssr)
const isHostSafeFrontend = (inputUrl, redisData) => {
  let hostname;
  try {
    const cleanUrl = inputUrl.trim();
    hostname = new URL(cleanUrl).hostname;
  } catch (e) {
    return false;
  }

  const baseDomain = getBaseDomain(hostname);
  const hash = crypto.createHash('sha256').update(baseDomain).digest();
  const prefix = hash.slice(0, redisData.prefixLength);

  // Decode base64 data from Redis
  const buffer = Buffer.from(redisData.data, 'base64');
  const prefixLen = redisData.prefixLength;

  // Linear search through binary data
  for (let i = 0; i < buffer.length; i += prefixLen) {
    const storedPrefix = buffer.slice(i, i + prefixLen);
    if (storedPrefix.equals(prefix)) {
      return true;
    }
  }

  return false;
};

// Generate the data for Redis
const redisData = generateRedisData(safeHosts);

// console.log('Redis data:', {
//   size: redisData.data.length,
//   prefixLength: redisData.prefixLength,
//   count: redisData.count,
//   memoryEstimate: `${(redisData.data.length * 0.75).toFixed(1)} KB`, // base64 is ~75% of original size
// });

// // Test the frontend function
// const testUrls = [
//   'https://facebook.com/@user',
//   'https://Facebook.com/profile',
//   'https://evil.facebook.com/malware',
//   'https://my.site/api',
//   'https://invalid-domain.com/test',
// ];

// console.log('\nTest results:');
// testUrls.forEach((url) => {
//   const safe = isHostSafeFrontend(url, redisData);
//   console.log(`${url} -> ${safe ? 'SAFE' : 'UNSAFE'}`);
// });

// Export for use in other files
module.exports = {
  generateRedisData,
  isHostSafeFrontend,
  getBaseDomain,
  normalizeDomain,
  redisData,
};

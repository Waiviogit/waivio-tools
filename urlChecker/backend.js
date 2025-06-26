const crypto = require('crypto');

const safeHosts = [
  'facebook.com',
  'my.site',
  'example-good.com',
  'google.com',
  'social.gifts',
  // ... up to 5000 entries
];

// Normalize domain for consistent hashing
const normalizeDomain = (domain) => domain.toLowerCase().trim();

// Create hash prefix as bytes (not hex string)
const getHashPrefixBytes = (host, prefixLen = 6) => {
  const baseDomain = normalizeDomain(host);
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

const getHostFromUrl = (url = '') => {
  try {
    // Clean the URL first
    let cleanUrl = url.trim();

    // Remove any trailing punctuation that might have slipped through
    cleanUrl = cleanUrl.replace(/[*.,;:!?)\]}>"']+$/, '');

    const urlObj = new URL(cleanUrl);
    return urlObj.hostname;
  } catch (error) {
    console.log(`Failed to parse URL: ${url}`, error.message);
    return null;
  }
};

// Frontend lookup function (to be used in ssr)
const isHostSafeFrontend = (inputUrl, redisData) => {
  const hostname = getHostFromUrl(inputUrl);
  if (!hostname) return false;

  const baseDomain = normalizeDomain(hostname);
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
  normalizeDomain,
  redisData,
};

/* global window */
// Frontend-only host safety checker
// This version works in browsers without Node.js crypto

// Normalize domain for consistent hashing
const normalizeDomain = (domain) => domain.toLowerCase().trim();

// Extract base domain (remove subdomains)
const getBaseDomain = (hostname) => {
  const normalized = normalizeDomain(hostname);
  const parts = normalized.split('.');
  if (parts.length <= 2) return normalized;
  return parts.slice(-2).join('.');
};

// Simple hash function for frontend (not as secure as SHA256 but sufficient for this use case)
const simpleHash = async (str) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray;
};

// Create hash prefix as bytes
const getHashPrefixBytes = async (host, prefixLen = 6) => {
  const normalized = normalizeDomain(host);
  const baseDomain = getBaseDomain(normalized);
  const hash = await simpleHash(baseDomain);
  return hash.slice(0, prefixLen);
};

// Frontend lookup function
const isHostSafeFrontend = async (inputUrl, redisData) => {
  let hostname;
  try {
    const cleanUrl = inputUrl.trim();
    hostname = new URL(cleanUrl).hostname;
  } catch (e) {
    return false;
  }

  const baseDomain = getBaseDomain(hostname);
  const hash = await simpleHash(baseDomain);
  const prefix = hash.slice(0, redisData.prefixLength);

  // Decode base64 data from Redis
  const binaryString = atob(redisData.data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const prefixLen = redisData.prefixLength;

  // Linear search through binary data
  for (let i = 0; i < bytes.length; i += prefixLen) {
    let match = true;
    for (let j = 0; j < prefixLen; j++) {
      if (bytes[i + j] !== prefix[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return true;
    }
  }

  return false;
};

// Example usage:
// const redisData = {
//     data: "base64EncodedDataFromRedis",
//     prefixLength: 6,
//     count: 5000
// };
//
// const isSafe = await isHostSafeFrontend('https://facebook.com/profile', redisData);

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isHostSafeFrontend,
    getBaseDomain,
    normalizeDomain,
    getHashPrefixBytes,
  };
} else if (typeof window !== 'undefined') {
  // Expose to window for browser usage
  window.isHostSafeFrontend = isHostSafeFrontend;
  window.getBaseDomain = getBaseDomain;
  window.normalizeDomain = normalizeDomain;
  window.getHashPrefixBytes = getHashPrefixBytes;
}

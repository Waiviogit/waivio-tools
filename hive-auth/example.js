const CryptoJS = require('crypto-js');
const HAS = require('./hive-auth-wrapper');

//  application information
const APP_META = {
  name: 'waivio',
  description: 'waivio application',
  icon: undefined,
};

const HAS_SERVER = 'wss://hive-auth.arcange.eu';

const generateQrCode = (evt) => {
  const { account, uuid, key } = evt;
  const json = JSON.stringify({
    account, uuid, key, host: HAS_SERVER,
  });

  // const URI = `has://auth_req/${btoa(json)}`;
  const URI = `has://auth_req/${Buffer.from(json).toString('base64')}`;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${URI}`;
  console.log(url);
  // todo frontend show QR CODE
  return url;
};

/**
 * Sends a broadcast request to the server
 * @param {Object} auth
 * @param {string} auth.username
 * @param {string} auth.token
 * @param {number} auth.expire
 * @param {string} auth.key
 * @param {Object} challenge
 * @param {function} cbWait
 */
const authorizeUserHAS = async ({ auth, challenge, cbWait }) => {
  try {
    if (auth.expire > Date.now()) {
      return { result: auth };
    }
    const authResp = await HAS.authenticate(auth, APP_META, challenge, cbWait);
    // do we need authResp?
    return { result: auth };
  } catch (error) {
    // if error  handle timeout authorization
    return { error };
  }
};
/**
 * Sends a broadcast request to the server
 * @param {Object} auth
 * @param {string} auth.username
 * @param {string} auth.token
 * @param {number} auth.expire
 * @param {string} auth.key
 * @param {string} keyType active|posting
 * @param {[]} opts
 * @param {function} cbWait
 */
const broadcastHAS = async ({
  auth, keyType, opts = [], cbWait,
}) => {
  try {
    const broadcast = await HAS.broadcast(auth, keyType, opts, cbWait);

    return { result: broadcast };
  } catch (error) {
    // if error  handle timeout broadcast
    return { error };
  }
};

/**
 * Makes a header payload
 * @param {Object} auth
 * @param {string} auth.username
 * @param {string} auth.token
 * @param {number} auth.expire
 * @param {string} auth.key
 */

const makeHiveAuthHeader = (auth) => {
  try {
    const { username, expire } = auth;
    const authString = JSON.stringify({ username, expire });
    const secretKey = process.env.AUTH; // Replace with your actual secret key

    const encrypted = CryptoJS.AES.encrypt(authString, secretKey);

    return encrypted.toString();
  } catch (error) {
    return '';
  }
};

// EXAMPLE BROADCAST

// (async () => {
//   const auth = {
//     username: 'flowmaster',
//     token: '99bca7e6-cfc6-489c-bca3-3ee878f2ee2f',
//     expire: 1698492927996,
//     key: '31192f17-718f-4dbe-95f5-223d98d04872',
//   };
//   const res = await broadcastHAS({
//     auth,
//     keyType: 'posting',
//     opts: [[
//       'vote',
//       {
//         voter: 'flowmaster',
//         author: 'arcange',
//         permlink: 'hive-finance-20231026-en',
//         weight: 10000,
//       },
//     ]],
//     cbWait: (e) => console.log(e),
//   });
//   console.log();
// })();

// EXAMPLE AUTH

// (async () => {
//   const auth = new HAS.Auth('flowmaster');
//
//   const { result, error } = await authorizeUserHAS({
//     auth, cbWait: generateQrCode,
//   });
//
//   console.log();
// })();

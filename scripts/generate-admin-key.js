import crypto from 'node:crypto';
console.log(crypto.randomBytes(36).toString('base64url'));

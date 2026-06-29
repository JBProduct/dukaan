// Auth helpers using only Node's built-in 'crypto' module — no bcrypt/jsonwebtoken needed.

const crypto = require('crypto');
const { readDB, writeDB } = require('./db');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function createSession(userId) {
  const sessions = readDB('sessions');
  const token = crypto.randomBytes(24).toString('hex');
  sessions.push({ token, userId: userId || null, createdAt: Date.now() });
  writeDB('sessions', sessions);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const sessions = readDB('sessions');
  return sessions.find((s) => s.token === token) || null;
}

function attachUserToSession(token, userId) {
  const sessions = readDB('sessions');
  const s = sessions.find((x) => x.token === token);
  if (s) {
    s.userId = userId;
    writeDB('sessions', sessions);
  }
}

function destroySession(token) {
  const sessions = readDB('sessions').filter((s) => s.token !== token);
  writeDB('sessions', sessions);
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [k, ...v] = part.trim().split('=');
    if (k) acc[k] = decodeURIComponent(v.join('='));
    return acc;
  }, {});
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  getSession,
  attachUserToSession,
  destroySession,
  parseCookies,
};

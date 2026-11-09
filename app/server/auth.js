import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

let pool;
export function db() {
  if (!pool) pool = mysql.createPool({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '', database: process.env.DB_NAME || 'studyflow', waitForConnections: true, connectionLimit: 10, charset: 'utf8mb4' });
  return pool;
}
const secret = () => process.env.AUTH_SECRET;
export function issueToken(user) {
  if (!secret()) throw new Error('AUTH_SECRET belum diatur.');
  const payload = Buffer.from(JSON.stringify({ id: user.id, exp: Date.now() + 30 * 864e5 })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}
export async function setSession(user) {
  const jar = await cookies();
  jar.set('studyflow_session', issueToken(user), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 30 * 86400 });
}
export async function currentUser() {
  const raw = (await cookies()).get('studyflow_session')?.value;
  if (!raw || !secret()) return null;
  const [payload, sig] = raw.split('.'); if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret()).update(payload).digest(); let actual;
  try { actual = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { const data = JSON.parse(Buffer.from(payload, 'base64url').toString()); if (data.exp < Date.now()) return null; const [rows] = await db().execute('SELECT id, username, email, name FROM users WHERE id = ?', [data.id]); return rows[0] || null; } catch { return null; }
}
export async function clearSession() { (await cookies()).delete('studyflow_session'); }
export const publicUser = ({ id, username, email, name }) => ({ id, username, email, name });
export const hashPassword = (password) => bcrypt.hash(password, 12);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);
export const newUserId = () => randomBytes(16).toString('hex');

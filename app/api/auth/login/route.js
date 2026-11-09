import { db, publicUser, setSession, verifyPassword } from '../../../server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const { username, password } = await request.json();
    const [rows] = await db().execute('SELECT id, username, email, name, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1', [username, username]);
    if (!rows[0] || !rows[0].password_hash || !(await verifyPassword(password || '', rows[0].password_hash))) return NextResponse.json({ error: 'Username/email atau kata sandi salah.' }, { status: 401 });
    const user = publicUser(rows[0]); await setSession(user); return NextResponse.json({ user });
  } catch { return NextResponse.json({ error: 'Login gagal. Periksa koneksi MySQL dan konfigurasi server.' }, { status: 500 }); }
}

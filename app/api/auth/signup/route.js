import { db, hashPassword, newUserId, publicUser, setSession } from '../../../server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const { username, email, password, name } = await request.json();
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username || '') || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8 || !name?.trim()) return NextResponse.json({ error: 'Periksa nama, username, email, dan kata sandi (minimal 8 karakter).' }, { status: 400 });
    const user = { id: newUserId(), username: username.trim(), email: email.trim().toLowerCase(), name: name.trim() };
    await db().execute('INSERT INTO users (id, username, email, name, password_hash) VALUES (?, ?, ?, ?, ?)', [user.id, user.username, user.email, user.name, await hashPassword(password)]);
    await setSession(user); return NextResponse.json({ user: publicUser(user) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error.code === 'ER_DUP_ENTRY' ? 'Username atau email sudah digunakan.' : 'Pendaftaran gagal. Periksa koneksi MySQL dan konfigurasi server.' }, { status: 500 }); }
}

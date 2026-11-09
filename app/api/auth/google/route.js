import { db, newUserId, publicUser, setSession } from '../../../server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export async function POST(request) {
  try {
    const { credential } = await request.json();
    if (!credential || !process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) return NextResponse.json({ error: 'Google Sign-In belum dikonfigurasi.' }, { status: 400 });
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    const claims = await r.json();
    if (!r.ok || claims.aud !== process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || claims.email_verified !== 'true') return NextResponse.json({ error: 'Token Google tidak valid atau email belum terverifikasi.' }, { status: 401 });
    const email = claims.email.toLowerCase();
    const [existing] = await db().execute('SELECT id, username, email, name FROM users WHERE google_sub = ? OR email = ? LIMIT 1', [claims.sub, email]);
    let user = existing[0];
    if (user) { await db().execute('UPDATE users SET google_sub = COALESCE(google_sub, ?) WHERE id = ?', [claims.sub, user.id]); }
    else {
      const username = `${email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20) || 'google'}_${claims.sub.slice(-6)}`;
      user = { id: newUserId(), username, email, name: claims.name || email.split('@')[0] };
      await db().execute('INSERT INTO users (id, username, email, name, google_sub) VALUES (?, ?, ?, ?, ?)', [user.id, username, email, user.name, claims.sub]);
    }
    user = publicUser(user); await setSession(user); return NextResponse.json({ user });
  } catch { return NextResponse.json({ error: 'Login Google gagal. Periksa MySQL dan konfigurasi server.' }, { status: 500 }); }
}

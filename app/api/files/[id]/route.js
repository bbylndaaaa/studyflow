import { currentUser, db } from '../../../server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

export async function GET(_request, { params }) {
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    const { id } = await params;
    const [rows] = await db().execute('SELECT file_name, mime_type, contents FROM user_files WHERE id = ? AND user_id = ? LIMIT 1', [id, user.id]);
    if (!rows[0]) return NextResponse.json({ error: 'Berkas tidak ditemukan.' }, { status: 404 });
    const safeName = String(rows[0].file_name).replace(/[\r\n"\\]/g, '_');
    return new Response(rows[0].contents, { headers: { 'Content-Type': rows[0].mime_type || 'application/octet-stream', 'Content-Disposition': `attachment; filename="${safeName}"`, 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Gagal mengambil berkas.' }, { status: 503 }); }
}

export async function DELETE(_request, { params }) {
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    const { id } = await params;
    const [result] = await db().execute('DELETE FROM user_files WHERE id = ? AND user_id = ?', [id, user.id]);
    return NextResponse.json({ ok: true, deleted: result.affectedRows > 0 });
  } catch { return NextResponse.json({ error: 'Gagal menghapus berkas dari MySQL.' }, { status: 503 }); }
}

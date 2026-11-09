import { currentUser, db } from '../../server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request) {
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    const form = await request.formData(); const file = form.get('file'); const id = String(form.get('id') || '');
    if (!id || !file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Berkas tidak valid.' }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: 'Ukuran berkas maksimal 10 MB.' }, { status: 413 });
    const contents = Buffer.from(await file.arrayBuffer());
    await db().execute('INSERT INTO user_files (id, user_id, file_name, mime_type, file_size, contents) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), mime_type = VALUES(mime_type), file_size = VALUES(file_size), contents = VALUES(contents)', [id, user.id, file.name || 'berkas', file.type || 'application/octet-stream', file.size, contents]);
    return NextResponse.json({ file: { id, name: file.name || 'berkas', size: file.size, type: file.type || 'application/octet-stream', kind: String(form.get('kind') || ''), refId: String(form.get('refId') || ''), added: new Date().toISOString() } }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Gagal menyimpan berkas ke MySQL. Pastikan tabel user_files sudah dibuat.' }, { status: 503 }); }
}

import { currentUser, db } from '../../server/auth';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

const TABLES = ['user_profiles', 'user_courses', 'user_tasks', 'user_materials', 'user_file_metadata', 'user_settings'];
const emptyData = () => ({ courses: [], tasks: [], notes: [], files: [], settings: {} });
const decode = (value) => typeof value === 'string' ? JSON.parse(value) : value;

async function writeData(userId, data) {
  const pool = db();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const table of TABLES) await conn.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    await conn.execute('INSERT INTO user_profiles (user_id, profile_data) VALUES (?, ?)', [userId, JSON.stringify(data.profile || {})]);
    const groups = [
      ['user_courses', data.courses], ['user_tasks', data.tasks], ['user_materials', data.notes], ['user_file_metadata', data.files],
    ];
    for (const [table, rows] of groups) {
      for (const item of rows) await conn.execute(`INSERT INTO ${table} (user_id, item_id, item_data) VALUES (?, ?, ?)`, [userId, String(item.id), JSON.stringify(item)]);
    }
    await conn.execute('INSERT INTO user_settings (user_id, settings_data) VALUES (?, ?)', [userId, JSON.stringify(data.settings || {})]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

async function readData(userId) {
  const pool = db();
  const [profile] = await pool.execute('SELECT profile_data FROM user_profiles WHERE user_id = ?', [userId]);
  const [courses] = await pool.execute('SELECT item_data FROM user_courses WHERE user_id = ? ORDER BY created_at, item_id', [userId]);
  const [tasks] = await pool.execute('SELECT item_data FROM user_tasks WHERE user_id = ? ORDER BY created_at, item_id', [userId]);
  const [notes] = await pool.execute('SELECT item_data FROM user_materials WHERE user_id = ? ORDER BY created_at, item_id', [userId]);
  const [files] = await pool.execute('SELECT item_data FROM user_file_metadata WHERE user_id = ? ORDER BY created_at, item_id', [userId]);
  const [settings] = await pool.execute('SELECT settings_data FROM user_settings WHERE user_id = ?', [userId]);
  const data = {
    ...emptyData(),
    profile: profile[0] ? decode(profile[0].profile_data) : {},
    courses: courses.map((r) => decode(r.item_data)), tasks: tasks.map((r) => decode(r.item_data)),
    notes: notes.map((r) => decode(r.item_data)), files: files.map((r) => decode(r.item_data)),
    settings: settings[0] ? decode(settings[0].settings_data) : {},
  };
  return data;
}

export async function GET() {
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    let data = await readData(user.id);
    // One-time migration for accounts saved before data was split into tables.
    if (!data.courses.length && !data.tasks.length && !data.notes.length && !data.files.length) {
      const [legacy] = await db().execute('SELECT payload FROM user_data WHERE user_id = ?', [user.id]);
      if (legacy[0]) {
        const old = decode(legacy[0].payload);
        data = { ...emptyData(), ...old, profile: old.profile || {} };
        await writeData(user.id, data);
      }
    }
    return NextResponse.json({ data });
  } catch { return NextResponse.json({ error: 'Gagal membaca data. Pastikan database sudah disiapkan dan skema terbaru sudah diimpor.' }, { status: 503 }); }
}

export async function PUT(request) {
  try {
    const user = await currentUser(); if (!user) return NextResponse.json({ error: 'Sesi tidak valid.' }, { status: 401 });
    const { data } = await request.json();
    if (!data || !Array.isArray(data.courses) || !Array.isArray(data.tasks) || !Array.isArray(data.notes) || !Array.isArray(data.files)) return NextResponse.json({ error: 'Format data tidak valid.' }, { status: 400 });
    await writeData(user.id, data);
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Gagal menyimpan data. Periksa koneksi MySQL dan pastikan skema terbaru sudah diimpor.' }, { status: 503 }); }
}

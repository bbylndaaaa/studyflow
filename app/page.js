'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { getBlob, delBlob, weekOf, mondayOf } from './lib';
import { Berkas, FileItem, Attach } from './Files';

const KEY = 'studyflow-v1';
const EMPTY = { courses: [], tasks: [], notes: [], files: [], settings: {} };
const normalizeData = (value) => ({
  courses: Array.isArray(value?.courses) ? value.courses : [],
  tasks: Array.isArray(value?.tasks) ? value.tasks : [],
  notes: Array.isArray(value?.notes) ? value.notes : [],
  files: Array.isArray(value?.files) ? value.files : [],
  settings: value?.settings && typeof value.settings === 'object' ? value.settings : {},
});
const hasSavedContent = (value) => ['courses', 'tasks', 'notes', 'files'].some((key) => Array.isArray(value?.[key]) && value[key].length > 0);
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const COLORS = ['#583a2b', '#704a36', '#815a43', '#946c51', '#654332', '#a17a5d'];
const PRIO = { tinggi: 'Prioritas tinggi', sedang: 'Prioritas sedang', rendah: 'Prioritas rendah' };
const uid = () => Math.random().toString(36).slice(2, 9);
function ScriptGoogle() { return <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => window.dispatchEvent(new Event('google-ready'))} />; }

function Icon({ name, size = 18 }) {
  const paths = {
    beranda: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
    tugas: <><path d="M8 4h8l3 3v14H5V4z"/><path d="M8 4v5h8V4M8 13h8M8 17h5"/></>,
    materi: <><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h4M8 12h8M8 16h8"/></>,
    berkas: <><path d="M3 7h7l2 2h9v11H3z"/><path d="M3 7V5h7l2 2"/></>,
    matkul: <><path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H12v19H6.5A3.5 3.5 0 0 0 3 24z"/><path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H12v19h5.5a3.5 3.5 0 0 1 3.5 3z"/></>,
    jadwal: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3M7 17h3"/></>,
    fokus: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 6-6"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
    book: <><path d="M3 5.5A3.5 3.5 0 0 1 6.5 2H12v19H6.5A3.5 3.5 0 0 0 3 24z"/><path d="M21 5.5A3.5 3.5 0 0 0 17.5 2H12v19h5.5a3.5 3.5 0 0 1 3.5 3z"/></>,
  };
  return <svg width={size} height={size} viewBox={name === 'matkul' || name === 'book' ? '0 0 24 24' : '0 0 24 24'} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.materi}</svg>;
}

const demo = () => {
  const c1 = uid(), c2 = uid();
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 16);
  return {
    courses: [
      { id: c1, name: 'Basis Data', code: 'IF2101', lecturer: 'Dr. Sari', sks: 3, color: COLORS[0], day: '1', start: '08:00', end: '10:30', room: 'Lab 2' },
      { id: c2, name: 'Kalkulus II', code: 'MA2102', lecturer: 'Pak Budi', sks: 3, color: COLORS[2], day: '3', start: '10:00', end: '12:00', room: 'R. 301' },
    ],
    tasks: [
      { id: uid(), title: 'Rancang ERD sistem perpustakaan', courseId: c1, due: d(2), priority: 'tinggi', week: 5, done: false, notes: 'Minimal 5 entitas, kumpulkan PDF.' },
      { id: uid(), title: 'Latihan soal integral lipat', courseId: c2, due: d(5), priority: 'sedang', week: 6, done: false, notes: '' },
    ],
    notes: [
      { id: uid(), courseId: c1, meeting: 4, date: d(-3).slice(0, 10), topic: 'Normalisasi 1NF – 3NF', summary: 'Hilangkan atribut berulang, ketergantungan parsial, dan transitif.', link: '' },
    ],
    files: [],
    settings: {},
  };
};

const fmtDue = (s) => new Date(s).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const left = (s) => Math.ceil((new Date(s) - Date.now()) / 864e5);
const dueLabel = (t) => {
  if (t.done) return null;
  const n = left(t.due);
  if (n < 0) return <span className="late">Terlambat {Math.abs(n)} hari</span>;
  if (n <= 2) return <span className="soon">{n === 0 ? 'Hari ini' : `${n} hari lagi`}</span>;
  return <span>{n} hari lagi</span>;
};

/* ---------- small pieces ---------- */
function Tag({ c }) {
  return c ? <span className="tag" style={{ background: c.color }}>{c.name}</span> : <span className="tag" style={{ background: '#8a93a8' }}>Tanpa matkul</span>;
}

function Modal({ title, fields, initial, onSave, onClose }) {
  const [v, setV] = useState(initial);
  const submit = (e) => { e.preventDefault(); onSave(v); };
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card modal" onSubmit={submit}>
        <h2>{title}</h2>
        <div className="form">
          {fields.map((f) => (
            <label key={f.name} className={f.full ? 'full' : ''}>
              {f.label}
              {f.type === 'textarea' ? (
                <textarea value={v[f.name] ?? ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              ) : f.type === 'select' ? (
                <select required={f.required} value={v[f.name] ?? ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>
                  {f.placeholder && <option value="">{f.placeholder}</option>}
                  {f.options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
                </select>
              ) : (
                <input type={f.type || 'text'} required={f.required} min={f.min} value={v[f.name] ?? ''} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
              )}
            </label>
          ))}
          <div className="full foot">
            <button type="button" className="btn" onClick={onClose}>Batal</button>
            <button className="btn primary">Simpan</button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ---------- main ---------- */
export default function Page() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [data, setData] = useState(EMPTY);
  const [ready, setReady] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [tab, setTab] = useState('beranda');
  const [modal, setModal] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.ok ? r.json() : null).then((v) => setUser(v?.user || null)).catch(() => {}).finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (!authReady || user) return;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const renderGoogle = () => {
      const g = window.google?.accounts?.id;
      const target = document.getElementById('google-signin');
      if (!g || !clientId || !target) return;
      target.replaceChildren();
      g.initialize({ client_id: clientId, callback: async ({ credential }) => {
        setAuthBusy(true); setAuthError('');
        try { const r = await fetch('/api/auth/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }) }); const v = await r.json(); if (!r.ok) throw new Error(v.error); setUser(v.user); }
        catch (e) { setAuthError(e.message || 'Login Google gagal.'); } finally { setAuthBusy(false); }
      } });
      g.renderButton(target, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 320 });
    };
    renderGoogle(); window.addEventListener('google-ready', renderGoogle);
    return () => window.removeEventListener('google-ready', renderGoogle);
  }, [authReady, user, authMode]);

  const submitAuth = async (e) => {
    e.preventDefault(); setAuthBusy(true); setAuthError('');
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch(`/api/auth/${authMode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(fd)) });
      const v = await r.json(); if (!r.ok) throw new Error(v.error || 'Autentikasi gagal.');
      setUser(v.user); setData(EMPTY);
    } catch (err) { setAuthError(err.message || 'Tidak dapat menghubungi server.'); }
    finally { setAuthBusy(false); }
  };
  const logout = async () => {
    if (loadedUserId === user?.id) {
      try {
        const response = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) });
        if (!response.ok) throw new Error('database');
      } catch { setSaveStatus('error'); alert('Data belum berhasil disimpan ke MySQL. Periksa koneksi database, lalu coba keluar lagi.'); return; }
    }
    await fetch('/api/auth/logout', { method: 'POST' }); setUser(null); setData(EMPTY); setLoadedUserId(null);
  };

  useEffect(() => {
    if (!user) { setData(EMPTY); setReady(false); setLoadedUserId(null); return; }
    setLoadedUserId(null); setReady(false); setSaveStatus('loading');
    let cancelled = false;
    fetch('/api/data').then(async (r) => { if (!r.ok) throw new Error('database'); return r.json(); }).then(({ data: saved }) => {
      if (cancelled) return;
      let localData = null;
      try { const local = localStorage.getItem(`${KEY}:${user.id}`); if (local) localData = normalizeData(JSON.parse(local)); } catch {}
      // If an earlier save wrote an empty payload, recover a fuller local copy
      // for this same account and let the normal autosave restore it to MySQL.
      const chosen = saved && hasSavedContent(saved) ? normalizeData(saved) : hasSavedContent(localData) ? localData : saved ? normalizeData(saved) : localData || EMPTY;
      setData(chosen);
      setLoadedUserId(user.id); setSaveStatus('saved');
    }).catch(() => {
      try { const local = localStorage.getItem(`${KEY}:${user.id}`); if (!cancelled && local) setData(normalizeData(JSON.parse(local))); } catch {}
      if (!cancelled) { setLoadedUserId(user.id); setSaveStatus('error'); }
    }).finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [user]);
  useEffect(() => {
    if (ready && user && loadedUserId === user.id) {
      const id = setTimeout(async () => {
        setSaveStatus('saving');
        try { const response = await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }) }); if (!response.ok) throw new Error('database'); setSaveStatus('saved'); }
        catch { setSaveStatus('error'); }
      }, 300);
      try { localStorage.setItem(`${KEY}:${user.id}`, JSON.stringify(data)); } catch {}
      return () => clearTimeout(id);
    }
  }, [data, ready, user, loadedUserId]);

  const courseMap = useMemo(() => Object.fromEntries(data.courses.map((c) => [c.id, c])), [data.courses]);

  if (!authReady) return <div className="auth-screen"><div className="auth-card">Memuat StudyFlow…</div></div>;
  if (!user) return <div className="auth-screen"><form className="auth-card" onSubmit={submitAuth}>
    <div className="auth-brand">StudyFlow</div>
    {authMode === 'signup' && <label>Nama lengkap<input name="name" required autoComplete="name" /></label>}
    <label>Username<input name="username" required minLength="3" autoComplete="username" /></label>
    {authMode === 'signup' && <label>Email<input name="email" type="email" required autoComplete="email" /></label>}
    <label>Kata sandi<input name="password" type="password" required minLength="8" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} /></label>
    {authError && <div className="auth-error" role="alert">{authError}</div>}
    <button className="btn primary auth-submit" disabled={authBusy}>{authBusy ? 'Memproses…' : authMode === 'login' ? 'Masuk' : 'Daftar'}</button>
    <div className="auth-divider">atau lanjutkan dengan</div><div id="google-signin" />{!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && <small className="auth-hint">Atur NEXT_PUBLIC_GOOGLE_CLIENT_ID untuk mengaktifkan Google Sign-In.</small>}
    <button type="button" className="auth-switch" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}>{authMode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}</button>
  </form><ScriptGoogle /></div>;

  const save = (k, item) => setData((d) => ({
    ...d,
    [k]: item.id ? d[k].map((x) => (x.id === item.id ? item : x)) : [...d[k], { ...item, id: uid() }],
  }));
  const del = async (k, id) => {
    if (!confirm('Hapus item ini?')) return;
    const gone = data.files.filter((f) => f.refId === id || (k === 'courses' && data.tasks.some((t) => t.courseId === id && t.id === f.refId)));
    try {
      await Promise.all(gone.map(async (f) => {
        const response = await fetch(`/api/files/${encodeURIComponent(f.id)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Gagal menghapus lampiran dari MySQL.');
        await delBlob(f.id).catch(() => {});
      }));
    } catch (error) { alert(error.message || 'Gagal menghapus lampiran.'); return; }
    setData((d) => {
      const files = d.files.filter((f) => !gone.some((g) => g.id === f.id));
      return k === 'courses'
        ? { ...d, files, courses: d.courses.filter((x) => x.id !== id), tasks: d.tasks.filter((x) => x.courseId !== id), notes: d.notes.filter((x) => x.courseId !== id) }
        : { ...d, files, [k]: d[k].filter((x) => x.id !== id) };
    });
  };
  const attach = async (kind, refId, list) => {
    const added = [];
    for (const file of Array.from(list)) {
      const id = uid();
      const form = new FormData(); form.set('id', id); form.set('kind', kind); form.set('refId', refId); form.set('file', file);
      try {
        const response = await fetch('/api/files', { method: 'POST', body: form }); const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal menyimpan berkas.');
        added.push(result.file);
      } catch (error) { alert(error.message || `Gagal menyimpan ${file.name} ke MySQL.`); }
    }
    if (added.length) setData((d) => ({ ...d, files: [...d.files, ...added] }));
  };
  const removeFile = async (f) => {
    if (!confirm(`Hapus berkas "${f.name}"?`)) return;
    try { const response = await fetch(`/api/files/${encodeURIComponent(f.id)}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Berkas belum berhasil dihapus dari MySQL.'); }
    catch (error) { alert(error.message || 'Gagal menghapus berkas.'); return; }
    delBlob(f.id).catch(() => {});
    setData((d) => ({ ...d, files: d.files.filter((x) => x.id !== f.id) }));
  };
  const toggleSubmit = (id) => setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, submitted: !t.submitted } : t)) }));
  const toggle = (id) => setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));

  const courseOpts = data.courses.map((c) => [c.id, c.name]);
  const forms = {
    courses: {
      title: 'Mata kuliah',
      blank: { name: '', code: '', lecturer: '', sks: 3, color: COLORS[0], semester: '', day: '1', start: '08:00', end: '10:00', room: '' },
      fields: [
        { name: 'name', label: 'Nama mata kuliah', required: true, full: true },
        { name: 'code', label: 'Kode' }, { name: 'sks', label: 'SKS', type: 'number', min: 1 },
        { name: 'lecturer', label: 'Dosen' }, { name: 'room', label: 'Ruang' },
        { name: 'semester', label: 'Semester ke-', type: 'number', min: 1, required: true },
        { name: 'day', label: 'Hari kuliah', type: 'select', options: DAYS.map((d, i) => [String(i), d]) },
        { name: 'color', label: 'Warna', type: 'select', options: COLORS.map((c, i) => [c, ['Biru', 'Merah', 'Hijau', 'Kuning', 'Ungu', 'Pink'][i]]) },
        { name: 'start', label: 'Mulai', type: 'time' }, { name: 'end', label: 'Selesai', type: 'time' },
      ],
    },
    tasks: {
      title: 'Tugas',
      blank: { title: '', courseId: data.courses[0]?.id || '', due: '', priority: 'sedang', week: weekOf(data.settings?.semesterStart) || '', done: false, notes: '' },
      fields: [
        { name: 'title', label: 'Judul tugas', required: true, full: true },
        { name: 'courseId', label: 'Mata kuliah', type: 'select', options: courseOpts, placeholder: 'Tanpa mata kuliah' },
        { name: 'week', label: 'Minggu kuliah ke-', type: 'number', min: 1 },
        { name: 'priority', label: 'Prioritas', type: 'select', options: Object.entries(PRIO) },
        { name: 'due', label: 'Tenggat', type: 'datetime-local', required: true, full: true },
        { name: 'notes', label: 'Catatan', type: 'textarea', full: true },
      ],
    },
    notes: {
      title: 'Materi',
      blank: { courseId: data.courses[0]?.id || '', meeting: '', date: new Date().toISOString().slice(0, 10), topic: '', summary: '', link: '' },
      fields: [
        { name: 'topic', label: 'Topik yang dibahas', required: true, full: true },
        { name: 'courseId', label: 'Mata kuliah', type: 'select', options: courseOpts, placeholder: 'Tanpa mata kuliah' },
        { name: 'meeting', label: 'Pertemuan ke-', type: 'number', min: 1 },
        { name: 'date', label: 'Tanggal', type: 'date', full: true },
        { name: 'summary', label: 'Ringkasan', type: 'textarea', full: true },
        { name: 'link', label: 'Link slide / referensi', type: 'url', full: true },
      ],
    },
  };
  const open = (k, item) => setModal({ k, item: item || forms[k].blank });

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = 'studyflow-backup.json'; a.click();
  };
  const importData = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => {
      try { const j = JSON.parse(t); if (j.courses && j.tasks && j.notes) setData({ ...EMPTY, ...j }); else alert('Format file tidak sesuai.'); }
      catch { alert('File tidak bisa dibaca.'); }
    });
    e.target.value = '';
  };

  const NAV = [['beranda', 'Beranda'], ['tugas', 'Tugas'], ['materi', 'Materi'], ['berkas', 'Berkas'], ['matkul', 'Mata kuliah'], ['jadwal', 'Jadwal'], ['fokus', 'Fokus']];
  const empty = data.courses.length === 0 && data.tasks.length === 0 && data.notes.length === 0;

  return (
    <div className="app">
      <nav className="side">
        <div className="brand"><Icon name="book" size={23} /><span>StudyFlow</span></div>
        {NAV.map(([id, label]) => (
          <button key={id} className={`nav ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}><Icon name={id} /><span>{label}</span></button>
        ))}
        <div className="grow" />
        <div className="sidebar-note"><span>Sedikit demi sedikit,<br />lama-lama jadi bukit.</span><b>✦</b><span className="leaf">♧</span></div>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={importData} />
      </nav>

      <main className="main">
        {tab !== 'fokus' && <div className="topbar">
          <label className="searchbox"><Icon name="search" size={16} /><input aria-label="Cari" placeholder="Cari tugas, materi, atau mata kuliah..." /></label>
          <button className="icon-button" aria-label="Notifikasi"><Icon name="bell" /></button>
          <span className="user-greeting">{user?.name || user?.username}</span>{saveStatus && <span className={`save-indicator ${saveStatus}`} role="status">{saveStatus === 'saving' ? 'Menyimpan…' : saveStatus === 'saved' ? 'Tersimpan' : saveStatus === 'loading' ? 'Memuat data…' : 'Gagal tersimpan'}</span>}<button className="btn sm" onClick={logout}>Keluar</button>
        </div>}
        {!ready ? <div className="card app-loading" role="status">Memuat StudyFlow…</div> : tab === 'beranda' ? (
          <Home data={data} courseMap={courseMap} toggle={toggle} empty={empty} loadDemo={() => setData(demo())} go={setTab} userName={user.name || user.username} />
        ) : tab === 'tugas' ? (
          <Tasks data={data} courseMap={courseMap} toggle={toggle} open={open} del={del} fx={{ files: data.files, attach, removeFile, toggleSubmit }} />
        ) : tab === 'materi' ? (
          <Notes data={data} courseMap={courseMap} open={open} del={del} attach={attach} removeFile={removeFile} />
        ) : tab === 'berkas' ? (
          <Berkas data={data} courseMap={courseMap} attach={attach} removeFile={removeFile} toggleSubmit={toggleSubmit} />
        ) : tab === 'matkul' ? (
          <Courses data={data} open={open} del={del} />
        ) : tab === 'jadwal' ? (
          <Schedule data={data} setSettings={(p) => setData((d) => ({ ...d, settings: { ...d.settings, ...p } }))} />
        ) : (
          <Focus tasks={data.tasks.filter((t) => !t.done)} />
        )}
      </main>

      {modal && (
        <Modal
          title={`${modal.item.id ? 'Ubah' : 'Tambah'} ${forms[modal.k].title.toLowerCase()}`}
          fields={forms[modal.k].fields}
          initial={modal.item}
          onClose={() => setModal(null)}
          onSave={(v) => { save(modal.k, v); setModal(null); }}
        />
      )}
    </div>
  );
}

/* ---------- views ---------- */
function Head({ title, sub, action }) {
  const icon = title === 'Fokus' ? null : title === 'Tugas' ? 'tugas' : title === 'Materi' ? 'materi' : title === 'Berkas' ? 'berkas' : title.includes('Mata kuliah') ? 'matkul' : title.includes('Jadwal') || title.includes('Minggu') ? 'jadwal' : 'beranda';
  return (
    <div className="head">
      <div className={`page-heading ${icon ? '' : 'focus-heading'}`}>{icon && <Icon name={icon} size={25} />}<div><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div></div>
      {action}
    </div>
  );
}

function StudyIllustration() {
  return <div className="study-art" aria-hidden="true"><span className="art-heart">♥</span><span className="art-heart second">♥</span><svg viewBox="0 0 230 115" fill="none"><path d="M22 88h86v9H22z" fill="#EABDAF"/><path d="M28 76h78v10H28z" fill="#A9B8F1"/><path d="M35 63h70v11H35z" fill="#F3D995"/><path d="M40 59h67M34 72h67M27 84h77" stroke="#7489C9" strokeWidth="2"/><path d="M156 85c-2-23 0-44 8-67M164 81c13-20 22-34 39-43M160 68c-14-15-21-28-23-42M166 55c1-16 7-28 19-39M157 71c-13-1-23 1-32 8" stroke="#628C75" strokeWidth="4" strokeLinecap="round"/><path d="M143 99h38l-5-26h-28z" fill="#E6B6A1"/><path d="M145 76c-8-11-11-24-7-34 11 6 16 17 16 31M164 62c-1-16 5-30 18-39 5 14 0 29-14 42M169 72c10-15 23-22 36-20-6 14-19 22-35 25" fill="#B4D1B3" stroke="#6F987C" strokeWidth="2"/><path d="M205 100c3-17 7-30 15-40" stroke="#668A70" strokeWidth="3" strokeLinecap="round"/><path d="M218 64c-8-5-10-12-7-18 8 2 12 8 11 15M218 73c6-8 12-10 17-7-2 7-8 11-15 10" fill="#A9C8A9" stroke="#668A70" strokeWidth="2"/></svg></div>;
}

function TaskRow({ t, c, toggle, open, del, fx }) {
  return (
    <div className={`row ${t.done ? 'done' : ''}`}>
      <input className="check" type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={`Selesaikan ${t.title}`} />
      <div className="body">
        <div className="title">{t.title}</div>
        <div className="meta">
          <Tag c={c} />{t.week && <span>Minggu {t.week}</span>}<span>{fmtDue(t.due)}</span>{dueLabel(t)}
          {t.priority === 'tinggi' && !t.done && <span className="late">Prioritas tinggi</span>}
          {t.done && (t.submitted ? <span className="ok">Sudah diunggah</span> : <span className="soon">Belum diunggah</span>)}
        </div>
        {t.notes && <p className="summary">{t.notes}</p>}
        {fx && (
          <div className="files">
            {fx.files.filter((f) => f.refId === t.id).map((f) => <FileItem key={f.id} f={f} onRemove={fx.removeFile} />)}
            <div className="acts">
              <Attach label="Lampirkan berkas" onPick={(l) => fx.attach('tugas', t.id, l)} />
              {t.done && <button className="btn sm" onClick={() => fx.toggleSubmit(t.id)}>{t.submitted ? 'Batal tandai diunggah' : 'Tandai sudah diunggah'}</button>}
            </div>
          </div>
        )}
      </div>
      {open && (
        <div className="acts">
          <button className="btn sm" onClick={() => open('tasks', t)}>Ubah</button>
          <button className="btn sm danger" onClick={() => del('tasks', t.id)}>Hapus</button>
        </div>
      )}
    </div>
  );
}

function Home({ data, courseMap, toggle, empty, loadDemo, go, userName }) {
  const active = data.tasks.filter((t) => !t.done).sort((a, b) => new Date(a.due) - new Date(b.due));
  const week = active.filter((t) => left(t.due) <= 7).length;
  const pct = data.tasks.length ? Math.round((data.tasks.filter((t) => t.done).length / data.tasks.length) * 100) : 0;
  const today = data.courses.filter((c) => Number(c.day) === new Date().getDay()).sort((a, b) => a.start.localeCompare(b.start));
  const wk = weekOf(data.settings?.semesterStart);
  const unsent = data.tasks.filter((t) => t.done && !t.submitted).length;
  const recent = [...data.notes].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);

  if (empty) return (
    <>
      <Head title="Selamat datang" sub="Mulai dengan menambahkan mata kuliah semester ini." />
      <div className="card empty">
        <p>Belum ada data. Tambahkan mata kuliah dulu, lalu catat tugas dan materinya.</p>
        <button className="btn primary" onClick={() => go('matkul')}>Tambah mata kuliah</button>{' '}
        <button className="btn" onClick={loadDemo}>Coba dengan data contoh</button>
      </div>
    </>
  );

  return (
    <>
      <div className="welcome-row"><Head title={`Halo, ${userName}!`} sub={<><span>Hari ini adalah langkah kecil menuju tujuan besarmu.</span><br /><span>{new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}{wk ? ` · Minggu ke-${wk}` : ''}</span></>} /><StudyIllustration /></div>
      <div className="stats">
        <div className="stat"><span>tugas aktif</span><b>{active.length}</b></div>
        <div className="stat"><span>tenggat 7 hari ke depan</span><b>{week}</b></div>
        <div className="stat"><span>selesai, belum diunggah</span><b>{unsent}</b></div>
        <div className="stat"><span>tugas selesai</span><b>{pct}%</b></div>
      </div>
      <div className="home-layout">
        <div className="home-left">
        <section className="card">
          <div className="section-title"><h2><Icon name="jadwal" size={17} />Jadwal hari ini</h2><button className="text-action" onClick={() => go('jadwal')}>Lihat semua ›</button></div>
          {today.length === 0 ? <div className="empty">Tidak ada kuliah hari ini.</div> : today.map((c) => (
            <div key={c.id} className="home-line"><span className="home-line-icon"><Icon name="jadwal" size={14} /></span><span className="home-line-time">{c.start}–{c.end}</span><b>{c.name}</b>{c.room && <span className="home-line-room">{c.room}</span>}</div>
          ))}
        </section>
        <section className="card">
          <div className="section-title"><h2><Icon name="tugas" size={17} />Tugas terdekat</h2><button className="text-action" onClick={() => go('tugas')}>Lihat semua ›</button></div>
          {active.length === 0 ? <div className="empty">Semua tugas beres.</div> : active.slice(0, 4).map((t) => (
            <div key={t.id} className="home-task"><input className="check" type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={`Selesaikan ${t.title}`} /><div className="body"><b>{t.title}</b><div className="meta"><Tag c={courseMap[t.courseId]} /><span>Due {left(t.due)} hari lagi</span></div></div></div>
          ))}
        </section>
        </div>
        <section className="card recent-card">
          <div className="section-title"><h2><Icon name="materi" size={17} />Materi terbaru</h2><button className="text-action" onClick={() => go('materi')}>Lihat semua ›</button></div>
          {recent.length === 0 ? <div className="empty">Belum ada catatan materi.</div> : recent.map((n) => (
            <div key={n.id} className="row"><div className="body"><div className="title">{n.topic}</div><div className="meta"><Tag c={courseMap[n.courseId]} />{n.meeting && <span>Pertemuan {n.meeting}</span>}</div></div></div>
          ))}
        </section>
      </div>
    </>
  );
}

function Tasks({ data, courseMap, toggle, open, del, fx }) {
  const [status, setStatus] = useState('semua');
  const [cid, setCid] = useState('');
  const [byWeek, setByWeek] = useState(false);
  const wkOf = (t) => Number(t.week) || 0;
  const list = data.tasks
    .filter((t) => (status === 'semua' ? true : status === 'aktif' ? !t.done : t.done))
    .filter((t) => !cid || t.courseId === cid)
    .sort((a, b) => (byWeek ? (wkOf(a) || 99) - (wkOf(b) || 99) : 0) || new Date(a.due) - new Date(b.due));
  const groups = byWeek ? [...new Set(list.map(wkOf))] : [null];
  return (
    <>
      <Head title="Tugas" sub="Urut dari tenggat terdekat." action={<button className="btn primary" onClick={() => open('tasks')}>Tambah tugas</button>} />
      <div className="chips">
        {['semua', 'aktif', 'selesai'].map((s) => <button key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{s === 'aktif' ? 'Belum selesai' : s[0].toUpperCase() + s.slice(1)}</button>)}
        <select className="chip" value={cid} onChange={(e) => setCid(e.target.value)} aria-label="Filter mata kuliah">
          <option value="">Semua mata kuliah</option>
          {data.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className={`chip ${byWeek ? 'on' : ''}`} onClick={() => setByWeek(!byWeek)}>Kelompokkan per minggu</button>
      </div>
      {list.length === 0 ? <div className="card empty">Tidak ada tugas di sini.</div> : groups.map((g) => (
        <div key={g ?? 'all'} className="card task-list" style={{ marginBottom: 14 }}>
          {byWeek && <h2>{g ? `Minggu ke-${g}` : 'Tanpa minggu'}</h2>}
          {list.filter((t) => !byWeek || wkOf(t) === g).map((t) => (
            <TaskRow key={t.id} t={t} c={courseMap[t.courseId]} toggle={toggle} open={open} del={del} fx={fx} />
          ))}
        </div>
      ))}
    </>
  );
}

function Notes({ data, courseMap, open, del, attach, removeFile }) {
  const [cid, setCid] = useState('');
  const [kind, setKind] = useState('Semua');
  const [query, setQuery] = useState('');
  const matchesKind = (f) => kind === 'Semua' || (kind === 'PDF' ? /\.pdf$/i.test(f.name) || f.type === 'application/pdf' : kind === 'Video' ? f.type.startsWith('video/') : kind === 'Link' ? false : true);
  const folders = data.courses.map((c) => ({ c, files: data.files.filter((f) => f.kind === 'materi' && f.refId === c.id && matchesKind(f)), notes: data.notes.filter((n) => n.courseId === c.id && (kind === 'Semua' || (kind === 'Link' && n.link))) }))
    .filter(({ c, files, notes }) => (!query || c.name.toLowerCase().includes(query.toLowerCase())) && (kind === 'Semua' || files.length || notes.length));
  const course = data.courses.find((c) => c.id === cid);
  const files = data.files.filter((f) => f.kind === 'materi' && f.refId === cid && matchesKind(f));
  const notes = data.notes.filter((n) => n.courseId === cid && (kind === 'Semua' || (kind === 'Link' && n.link)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.meeting || 0) - (a.meeting || 0));
  return (
    <>
      <Head title="Materi" sub={course ? `Folder materi · ${course.name}` : 'Semua materi tersusun berdasarkan mata kuliah.'} action={<div className="head-actions"><label className="page-search"><Icon name="search" size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari materi..." /></label><button className="btn primary" onClick={() => open('notes')}>+ Tambah materi</button></div>} />
      <div className="chips filter-chips">
        {['Semua', 'PDF', 'Video', 'Link'].map((k) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{k}</button>)}
        {course && <button className="chip" onClick={() => setCid('')}>← Semua mata kuliah</button>}
      </div>
      {!cid ? (folders.length === 0 ? <div className="card empty">Belum ada folder materi. Tambahkan mata kuliah atau unggah materi.</div> : (
        <div className="grid g3 folder-grid">
          {folders.map(({ c, files: folderFiles, notes: folderNotes }, i) => (
            <button type="button" key={c.id} className={`folder-card folder-${i % 6}`} onClick={() => setCid(c.id)}>
              <span className="folder-icon"><Icon name="berkas" size={23} /></span><b>{c.name}</b><span>{folderFiles.length + folderNotes.length} materi</span><span className="folder-arrow">›</span>
            </button>
          ))}
        </div>
      )) : !course ? <div className="card empty">Mata kuliah tidak ditemukan.</div> : (
        <>
          <div className="folder-toolbar"><div><h2>{course.name}</h2><p className="sub">{files.length + notes.length} materi tersimpan</p></div><div className="acts"><Attach label="Unggah PDF / PPT" onPick={(l) => attach('materi', cid, l)} /><button className="btn primary" onClick={() => open('notes', { courseId: cid, meeting: '', date: new Date().toISOString().slice(0, 10), topic: '', summary: '', link: '' })}>+ Catatan</button></div></div>
          {files.length > 0 && <div className="material-files">{files.map((f) => <FileItem key={f.id} f={f} onRemove={removeFile} />)}</div>}
          {notes.length > 0 && <div className="grid g2 material-notes">{notes.map((n) => (
            <article key={n.id} className="card stripe" style={{ '--c': course.color }}>
              <div className="meta" style={{ marginTop: 0 }}>{n.meeting && <span>Pertemuan {n.meeting}</span>}{n.date && <span>{new Date(n.date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>}</div>
              <h2 style={{ margin: '8px 0 0' }}>{n.topic}</h2>{n.summary && <p className="summary">{n.summary}</p>}
              <div className="acts" style={{ marginTop: 12 }}>{n.link && <a className="btn sm" href={n.link} target="_blank" rel="noreferrer">Buka referensi</a>}<button className="btn sm" onClick={() => open('notes', n)}>Ubah</button><button className="btn sm danger" onClick={() => del('notes', n.id)}>Hapus</button></div>
            </article>
          ))}</div>}
          {!files.length && !notes.length && <div className="card empty">Folder ini masih kosong. Unggah PDF atau PPT, atau tambahkan catatan.</div>}
        </>
      )}
    </>
  );
}

function Courses({ data, open, del }) {
  const sks = data.courses.reduce((s, c) => s + Number(c.sks || 0), 0);
  return (
    <>
      <Head title="Mata kuliah" sub={`${data.courses.length} mata kuliah · ${sks} SKS`} action={<button className="btn primary" onClick={() => open('courses')}>Tambah mata kuliah</button>} />
      {data.courses.length === 0 ? <div className="card empty">Belum ada mata kuliah.</div> : (
        <div className="grid g3">
          {data.courses.map((c) => {
            const pending = data.tasks.filter((t) => t.courseId === c.id && !t.done).length;
            const mats = data.notes.filter((n) => n.courseId === c.id).length;
            return (
              <article key={c.id} className="card stripe" style={{ '--c': c.color }}>
                <h2 style={{ marginBottom: 2 }}>{c.name}</h2>
                <div className="meta" style={{ marginTop: 0 }}>{c.code && <span>{c.code}</span>}<span>{c.sks} SKS</span><span>Semester {c.semester || '—'}</span></div>
                <div className="meta">{c.lecturer && <span>{c.lecturer}</span>}</div>
                <div className="meta">{DAYS[c.day]}, {c.start}–{c.end}{c.room && ` · ${c.room}`}</div>
                <div className="meta"><b>{pending}</b> tugas aktif · <b>{mats}</b> materi</div>
                <div className="acts" style={{ marginTop: 12 }}>
                  <button className="btn sm" onClick={() => open('courses', c)}>Ubah</button>
                  <button className="btn sm danger" onClick={() => del('courses', c.id)}>Hapus</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

function Schedule({ data, setSettings }) {
  const [off, setOff] = useState(0);
  const [selectedDay, setSelectedDay] = useState((new Date().getDay() + 6) % 7);
  const start = data.settings?.semesterStart || '';
  const mon = mondayOf(new Date());
  mon.setDate(mon.getDate() + off * 7);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const wk = weekOf(start, mon);
  const same = (a, b) => new Date(a).toDateString() === b.toDateString();
  const fmt = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const cm = Object.fromEntries(data.courses.map((c) => [c.id, c]));
  return (
    <>
      <Head
        title={wk ? `Minggu ke-${wk}` : 'Jadwal mingguan'}
        sub={`${fmt(days[0])} – ${fmt(days[5])} · jadwal kuliah dan tenggat tugas`}
        action={
          <div className="acts">
            <button className="btn sm" onClick={() => setOff(off - 1)}>Minggu lalu</button>
            <button className="btn sm" onClick={() => setOff(0)}>Minggu ini</button>
            <button className="btn sm" onClick={() => setOff(off + 1)}>Minggu depan</button>
          </div>
        }
      />
      <div className="schedule-panel card">
        <div className="schedule-days">
          {days.map((d, i) => (
            <button key={+d} className={`schedule-day ${selectedDay === i ? 'selected' : ''} ${same(new Date(), d) ? 'today' : ''}`} onClick={() => setSelectedDay(i)}>
              <span>{DAYS[d.getDay()].slice(0, 3)}</span><b>{d.getDate()}</b>
            </button>
          ))}
        </div>
        <h2 className="schedule-date">{days[selectedDay].toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        <div className="schedule-events">
          {[
            ...data.courses.filter((c) => Number(c.day) === days[selectedDay].getDay()).map((c) => ({ id: `c-${c.id}`, kind: 'Kuliah', title: c.name, time: `${c.start}–${c.end}`, detail: [c.room, `Semester ${c.semester || '—'}`].filter(Boolean).join(' · '), color: c.color, done: false })),
            ...data.tasks.filter((t) => same(t.due, days[selectedDay])).map((t) => ({ id: `t-${t.id}`, kind: 'Deadline tugas', title: t.title, time: new Date(t.due).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), detail: `Tenggat${t.done ? ' · selesai' : ''}`, color: '#9b765b', done: t.done })),
          ].sort((a, b) => a.time.localeCompare(b.time)).map((event) => (
            <div className="schedule-event" key={event.id} style={{ '--event-color': event.color, opacity: event.done ? .62 : 1 }}>
              <span className="event-dot" />
              <span className="event-time">{event.time}</span>
              <div className="event-info"><b>{event.title}</b><span><i className={`event-kind ${event.kind === 'Kuliah' ? 'kind-class' : 'kind-task'}`}>{event.kind}</i> {event.detail}</span></div>
            </div>
          ))}
          {data.courses.every((c) => Number(c.day) !== days[selectedDay].getDay()) && data.tasks.every((t) => !same(t.due, days[selectedDay])) && <p className="empty">Belum ada jadwal atau tenggat pada hari ini.</p>}
        </div>
        <p className="schedule-reminder">Jangan lupa istirahat juga ya! <span>♥</span></p>
      </div>
      <div className="card form" style={{ marginTop: 18 }}>
        <label className="full">
          Awal semester (tanggal Senin minggu ke-1), untuk menghitung minggu kuliah
          <input type="date" value={start} onChange={(e) => setSettings({ semesterStart: e.target.value })} />
        </label>
      </div>
    </>
  );
}

function Focus({ tasks }) {
  const MODES = { fokus: 25, istirahat: 5 };
  const [mode, setMode] = useState('fokus');
  const [sec, setSec] = useState(25 * 60);
  const [run, setRun] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [taskId, setTaskId] = useState('');

  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setSec((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [run]);
  useEffect(() => {
    if (sec > 0) return;
    setRun(false);
    if (mode === 'fokus') setSessions((n) => n + 1);
    const next = mode === 'fokus' ? 'istirahat' : 'fokus';
    setMode(next); setSec(MODES[next] * 60);
  }, [sec]); // eslint-disable-line

  const pick = (m) => { setMode(m); setSec(MODES[m] * 60); setRun(false); };
  const mm = String(Math.floor(sec / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
  return (
    <>
      <Head title="Fokus" sub="Belajar 25 menit, istirahat 5 menit." />
      <div className="card timer">
        <div className="chips" style={{ justifyContent: 'center' }}>
          {Object.keys(MODES).map((m) => <button key={m} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => pick(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}
        </div>
        <div className="time" aria-live="off">{mm}:{ss}</div>
        <p className="sub">{sessions} sesi fokus selesai hari ini</p>
        <select className="chip" value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label="Tugas yang dikerjakan" style={{ marginBottom: 16 }}>
          <option value="">Pilih tugas yang dikerjakan</option>
          {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <div>
          <button className="btn primary" onClick={() => setRun(!run)}>{run ? 'Jeda' : 'Mulai'}</button>{' '}
          <button className="btn" onClick={() => pick(mode)}>Atur ulang</button>
        </div>
      </div>
    </>
  );
}

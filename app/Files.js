'use client';
import { useRef, useState } from 'react';
import { downloadFile, fmtDue, fmtSize } from './lib';

export function FileItem({ f, onRemove }) {
  return (
    <div className="file">
      <button type="button" className="link" onClick={() => downloadFile(f)} title="Unduh berkas">{f.name}</button>
      <span className="sub">{fmtSize(f.size)}</span>
      <button type="button" className="btn sm danger" onClick={() => onRemove(f)}>Hapus</button>
    </div>
  );
}

export function Attach({ label, onPick }) {
  const r = useRef(null);
  return (
    <>
      <button type="button" className="btn sm" onClick={() => r.current.click()}>{label}</button>
      <input
        ref={r} type="file" multiple hidden
        onChange={(e) => { const list = Array.from(e.target.files); e.target.value = ''; if (list.length) onPick(list); }}
      />
    </>
  );
}

const Tag = ({ c }) => (
  <span className="tag" style={{ background: c?.color || '#8a93a8' }}>{c?.name || 'Tanpa matkul'}</span>
);

export function Berkas({ data, courseMap, attach, removeFile, toggleSubmit }) {
  const [sec, setSec] = useState('tugas');
  const [st, setSt] = useState('belum');
  const [courseId, setCourseId] = useState('');
  const hasFiles = (t) => data.files.some((f) => f.refId === t.id);
  const pending = data.tasks.filter((t) => t.done && !t.submitted).length;
  const tasks = data.tasks
    .filter((t) => (st === 'belum' ? t.done && !t.submitted : st === 'sudah' ? t.submitted : t.done || hasFiles(t)))
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  const rows = tasks.flatMap((t) => {
    const fs = data.files.filter((f) => f.refId === t.id);
    return fs.length ? fs.map((f) => ({ f, t })) : [{ f: null, t }];
  });

  return (
    <>
      <div className="head">
        <div>
          <div className="page-heading"><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h4M8 12h8M8 16h8"/></svg><h1>Berkas</h1></div>
        </div>
      </div>
      <div className="chips file-sections">
        <button className={`chip ${sec === 'tugas' ? 'on' : ''}`} onClick={() => setSec('tugas')}>Tugas selesai{pending > 0 ? ` (${pending} belum diunggah)` : ''}</button>
        <button className={`chip ${sec === 'materi' ? 'on' : ''}`} onClick={() => setSec('materi')}>Materi per mata kuliah</button>
      </div>

      {sec === 'tugas' ? (
        <>
          <div className="chips file-statuses">
            {[['belum', 'Belum diunggah ke GDrive'], ['sudah', 'Sudah diunggah'], ['semua', 'Semua']].map(([k, l]) => (
              <button key={k} className={`chip ${st === k ? 'on' : ''}`} onClick={() => setSt(k)}>{l}</button>
            ))}
          </div>
          <section className="card file-manager task-file-manager">
            {tasks.length === 0 ? (
              <div className="empty">
                {st === 'belum' ? 'Tidak ada tugas yang menunggu diunggah. Tandai tugas selesai di halaman Tugas, lalu lampirkan hasilnya.' : 'Belum ada tugas di sini.'}
              </div>
            ) : (
              <div className="file-table-wrap"><table className="file-table"><thead><tr><th>Nama file / Tugas</th><th>Mata kuliah</th><th>Tanggal</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
              {rows.map(({ f, t }, i) => {
              const c = courseMap[t.courseId];
              return (
                <tr key={f?.id || `${t.id}-${i}`}>
                  <td><div className="file-name-cell">{f ? <><span className={`file-type-icon type-${(f.name.split('.').pop() || '').toLowerCase()}`}>{(f.name.split('.').pop() || 'FILE').slice(0,3).toUpperCase()}</span><button className="link" onClick={() => downloadFile(f)}>{f.name}</button></> : <span>{t.title} <small className="sub">(belum ada berkas)</small></span>}</div></td>
                  <td>{c?.name || 'Tanpa mata kuliah'}</td>
                  <td>{f?.added ? new Date(f.added).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(t.due).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{t.submitted ? <span className="ok">Sudah diunggah</span> : <span className="soon">Belum diunggah</span>}</td>
                  <td><div className="acts">{f && <button className="btn sm danger" onClick={() => removeFile(f)}>Hapus</button>}<Attach label="+ Upload" onPick={(l) => attach('tugas', t.id, l)} />{t.done && <button className="btn sm" onClick={() => toggleSubmit(t.id)}>{t.submitted ? 'Batalkan' : 'Tandai diunggah'}</button>}</div></td>
                </tr>
              );
              })}
              </tbody></table></div>
            )}
          </section>
        </>
      ) : data.courses.length === 0 ? (
        <div className="card empty">Tambahkan mata kuliah dulu supaya folder materinya terbentuk.</div>
      ) : (
        <section className="card file-manager">
          <div className="file-manager-toolbar">
            <label className="course-select">Folder mata kuliah
              <select value={courseId || data.courses[0].id} onChange={(e) => setCourseId(e.target.value)}>
                {data.courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Attach label="+ Upload" onPick={(l) => attach('materi', courseId || data.courses[0].id, l)} />
          </div>
          <div className="file-table-wrap"><table className="file-table"><thead><tr><th>Nama file</th><th>Mata kuliah</th><th>Jenis</th><th>Tanggal</th><th></th></tr></thead><tbody>
            {data.files.filter((f) => f.kind === 'materi').length === 0 ? <tr><td colSpan="5" className="table-empty">Belum ada berkas materi. Unggah PDF, slide, atau dokumen kuliahmu.</td></tr> : data.files.filter((f) => f.kind === 'materi').sort((a, b) => (b.added || '').localeCompare(a.added || '')).map((f) => {
              const ext = f.name.split('.').pop()?.toUpperCase() || 'FILE';
              return <tr key={f.id}><td><div className="file-name-cell"><span className={`file-type-icon type-${ext.toLowerCase()}`}>{ext.slice(0, 3)}</span><button className="link" onClick={() => downloadFile(f)}>{f.name}</button></div></td><td>{courseMap[f.refId]?.name || 'Mata kuliah dihapus'}</td><td>{ext}</td><td>{f.added ? new Date(f.added).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td><td><button className="btn sm danger" onClick={() => removeFile(f)}>Hapus</button></td></tr>;
            })}
          </tbody></table></div>
        </section>
      )}
      <p className="sub" style={{ marginTop: 18 }}>
      </p>
    </>
  );
}

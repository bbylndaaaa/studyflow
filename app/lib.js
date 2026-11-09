// Penyimpanan berkas di IndexedDB (browser) + fungsi tanggal bersama.

export const fmtSize = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export const fmtDue = (s) =>
  new Date(s).toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const openDB = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open('studyflow-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('blobs');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const run = async (mode, fn) => {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('blobs', mode);
    const req = fn(tx.objectStore('blobs'));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
  });
};

export const putBlob = (id, blob) => run('readwrite', (s) => s.put(blob, id));
export const getBlob = (id) => run('readonly', (s) => s.get(id));
export const delBlob = (id) => run('readwrite', (s) => s.delete(id));

export async function downloadFile(f) {
  try {
    let blob;
    const response = await fetch(`/api/files/${encodeURIComponent(f.id)}`);
    if (response.ok) blob = await response.blob();
    else if (response.status === 404) blob = await getBlob(f.id);
    else throw new Error('Gagal mengambil berkas.');
    if (!blob) throw new Error('Berkas tidak ditemukan.');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch {
    alert('Gagal membuka berkas.');
  }
}

export const mondayOf = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};

// Nomor minggu kuliah dari tanggal awal semester (null jika belum diatur)
export const weekOf = (start, d = new Date()) =>
  start ? Math.round((mondayOf(d) - mondayOf(start)) / (7 * 864e5)) + 1 : null;

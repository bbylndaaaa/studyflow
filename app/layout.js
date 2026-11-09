import './globals.css';

export const metadata = {
  title: 'StudyFlow – Catatan Kuliah',
  description: 'Atur tugas, materi, dan jadwal kuliahmu di satu tempat.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

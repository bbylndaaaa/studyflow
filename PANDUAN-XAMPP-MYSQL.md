# Menyiapkan StudyFlow dengan XAMPP dan MySQL

## 1. Jalankan MySQL

1. Instal dan buka XAMPP Control Panel.
2. Klik **Start** pada modul **MySQL**. Apache tidak diperlukan untuk menjalankan Next.js; phpMyAdmin tersedia jika Apache juga dinyalakan.
3. Buka `http://localhost/phpmyadmin`.

## 2. Buat database dan tabel aplikasi

1. Pilih tab **Import** di phpMyAdmin.
2. Pilih file `database/studyflow.sql`, lalu klik **Import** atau **Go**.
3. Pastikan database `studyflow` dan tabel berikut muncul:
   - `users`: akun login dan profil dasar (nama, email, username).
   - `user_profiles`: data profil tambahan per akun.
   - `user_courses`: mata kuliah.
   - `user_tasks`: tugas dan deadline.
   - `user_materials`: catatan/materi.
   - `user_file_metadata`: metadata lampiran.
   - `user_files`: isi file lampiran.
   - `user_settings`: pengaturan seperti awal semester.
   - `user_data`: data JSON versi lama, dipertahankan sementara sebagai sumber migrasi otomatis.

Alternatif: buka tab **SQL**, tempel isi file tersebut, lalu jalankan.

## 3. Konfigurasi aplikasi

1. Salin `.env.example` menjadi `.env.local` di folder proyek.
2. Sesuaikan `DB_USER` dan `DB_PASSWORD` dengan konfigurasi MySQL XAMPP. Instalasi lokal XAMPP sering menggunakan `root` tanpa password; jika akun MySQL Anda memiliki password, isi nilainya.
3. Ganti `AUTH_SECRET` dengan string acak rahasia minimal 32 karakter.
4. Jalankan `npm install` untuk memasang driver MySQL dan pustaka hash kata sandi.
5. Jalankan `npm run dev`, lalu buka `http://localhost:3000`.

## 4. Aktifkan Google Sign-In (opsional)

1. Di Google Cloud Console, buat project dan OAuth Client ID bertipe **Web application**.
2. Tambahkan origin JavaScript yang diizinkan, misalnya `http://localhost:3000`.
3. Isi `NEXT_PUBLIC_GOOGLE_CLIENT_ID` pada `.env.local` dengan Client ID tersebut.
4. Restart server Next.js. Tombol Google akan muncul pada halaman masuk/daftar.

## Akun dan data

Pendaftaran menyimpan hash kata sandi bcrypt, bukan kata sandi asli. Sesi menggunakan cookie HTTP-only. Data jadwal, tugas, materi, pengaturan, metadata, dan isi lampiran disimpan di MySQL per akun. Ukuran lampiran dibatasi maksimal 10 MB per file.

Jika database `studyflow` sudah dibuat sebelumnya, impor ulang `database/studyflow.sql` agar tabel-tabel terpisah ikut dibuat. Perintah `CREATE TABLE IF NOT EXISTS` tidak menghapus data akun yang sudah ada. Saat akun lama membuka aplikasi setelah skema diperbarui, data dari `user_data` akan disalin otomatis ke tabel-tabel baru; jangan hapus tabel `user_data` sebelum proses migrasi selesai.

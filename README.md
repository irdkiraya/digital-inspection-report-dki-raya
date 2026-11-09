# Inspection Report – Astra Daihatsu Pamulang (Vue 3 + Vite)

Demo aplikasi inspeksi: daftar data (cari, detail, export PDF) dan form input (header + baris jasa/sparepart dinamis).
Data bersifat sementara (di memori), kembali ke contoh awal saat halaman dimuat ulang.

## Menjalankan
```bash
npm install
npm run dev      # development
npm run build    # hasil build ada di folder dist/
```
Membutuhkan Node.js 18+.

## Struktur
- `src/App.vue` – layout, navigasi, state data
- `src/views/ListView.vue` – daftar + pencarian
- `src/views/FormView.vue` – form input
- `src/components/DetailModal.vue` – detail + tombol export PDF
- `src/utils.js` – format Rupiah/tanggal, total, export PDF (jsPDF)
- `src/data.js` – data contoh
- `src/style.css` – tema biru-putih soft (responsif, dark mode otomatis)

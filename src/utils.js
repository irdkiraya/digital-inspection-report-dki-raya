import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export const total = (r) => r.items.reduce((s, i) => s + (+i.qty || 0) * (+i.harga || 0), 0)
export const rp = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID')
export const fd = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

// Helper untuk mengubah gambar lokal public menjadi Base64 untuk jsPDF
async function getBase64ImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = (error) => reject(error)
    img.src = url
  })
}

export async function exportPdf(r, advisors = []) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'landscape' })

  let profile = {}
  try {
    profile = JSON.parse(localStorage.getItem('active_profile')) || {}
  } catch (e) {
    profile = {}
  }

  const namaCabang = profile.nama ||'PT. ASTRA DAIHATSU'
  const alamatCabang = profile.alamat || 'Jl. Siliwangi No. 2, Pondok Benda, Pamulang'
  const kotaCabang = profile.kota ? `, ${profile.kota}` : ''

  // 1. MEMUAT LOGO DARI FOLDER PUBLIC UTAMA (/logo-astra.png)
  try {
    const base64Img = await getBase64ImageFromURL('/logo-astra.png')
    doc.addImage(base64Img, 'PNG', 10, 8, 42, 10)
  } catch (err) {
    // Fallback jika gagal memuat gambar
    doc.setFillColor(235, 242, 250)
    doc.roundedRect(10, 8, 48, 12, 2, 2, 'F')
    doc.setFontSize(10).setFont(undefined, 'bold').setTextColor(20, 70, 140)
    doc.text('ASTRA DAIHATSU', 12, 15)
    doc.setTextColor(0, 0, 0)
  }

  // 2. Header Kiri: Nama & Alamat Cabang
  doc.setFontSize(10).setFont(undefined, 'bold').text(namaCabang, 10, 24)
  doc.setFontSize(7.5).setFont(undefined, 'normal')
  const splitAlamat = doc.splitTextToSize(alamatCabang + kotaCabang, 80)
  doc.text(splitAlamat, 10, 28)

  // 3. Header Kanan: Informasi Estimasi & Daftar Advisor (Menangani .phone / .telp / .no_telp)
  doc.setFontSize(8).setFont(undefined, 'bold')
  doc.text('Informasi Estimasi / Booking Service (H-2)', 200, 10, { align: 'right' })
  
  doc.setFontSize(7.5).setFont(undefined, 'normal')
  let startYRight = 14
  if (advisors && advisors.length > 0) {
    advisors.forEach((adv) => {
      const teleponAdvisor = adv.phone || adv.telp || adv.no_telp || adv.telepon || adv.hp || '-'
      doc.text(`${adv.nama} : ${teleponAdvisor}`, 200, startYRight, { align: 'right' })
      startYRight += 4
    })
  } else {
    doc.text(`${r.advisor || 'Advisor'} : -`, 200, startYRight, { align: 'right' })
  }

  // 4. Judul Dokumen Tengah
  doc.setFontSize(11).setFont(undefined, 'bold').text('INSPECTION REPORT', 105, 40, { align: 'center' })

  // 5. Informasi Utama (Grid 2 Kolom)
  doc.setFontSize(8.5).setFont(undefined, 'normal')
  const h = [
    ['Tanggal Pemeriksaan', fd(r.tanggal), 'Nama Customer', r.nama],
    ['Service Advisor', r.advisor || '-', 'Nomor Telfon', r.telp || '-'],
    ['Nomor Polisi', r.polisi, 'Rencana Penggantian', r.rencana || '-']
  ]
  
  h.forEach((x, i) => {
    const y = 48 + (i * 5)
    doc.text(`${x[0]} : ${x[1]}`, 10, y)
    doc.text(`${x[2]} : ${x[3]}`, 110, y)
  })

  // 6. Tabel Rincian Jasa & Sparepart
  autoTable(doc, {
    startY: 65,
    head: [['No', 'Jasa/Sparepart', 'Qty', 'Harga Satuan', 'Harga Total']],
    body: [
      ...r.items.map((i, n) => [
        n + 1, 
        i.jasa, 
        i.qty, 
        rp(i.harga), 
        rp((+i.qty || 0) * (+i.harga || 0))
      ]),
      [{ content: 'TOTAL', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }, { content: rp(total(r)), styles: { fontStyle: 'bold' } }]
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [150, 170, 200] },
    headStyles: { fillColor: [74, 143, 224] },
    margin: { left: 10, right: 10 }
  })

  // 7. Catatan Kaki Bawah & Informasi Rekening Pembayaran
  let currentY = doc.lastAutoTable.finalY + 6
  doc.setFontSize(7.5).setFont(undefined, 'normal')
  doc.text('*Bawa kembali form ini & lakukan booking H-2 untuk mendapatkan diskon jasa 15%', 10, currentY)
  
  currentY += 5
  doc.setFont(undefined, 'bold')
  doc.text('Pembayaran dapat ditransfer ke :', 10, currentY)
  currentY += 4
  doc.text('Rekening BCA :', 10, currentY)
  currentY += 4
  doc.text('An. PT. Astra International Tbk', 10, currentY)
  currentY += 4
  doc.text('No Rekening : 764.361.9999', 10, currentY)

  // Simpan File PDF
  doc.save(`inspection-${r.id}-${r.polisi.replace(/\s+/g, '')}.pdf`)
}

export function exportExcel(rows) {
  if (!rows || !rows.length) {
    alert('Tidak ada data untuk diexport.')
    return
  }

  const dataToExport = rows.map((r, index) => {
    // Menggabungkan daftar jasa/sparepart menjadi satu teks (misal: "Ganti Oli (1), Filter Oli (1)")
    const daftarItem = r.items && r.items.length 
      ? r.items.map(i => `${i.jasa} (Qty: ${i.qty}, ${rp(i.harga)})`).join('; ') 
      : '-'

    return {
      'No': index + 1,
      'ID Laporan': r.id,
      'Tanggal': r.tanggal,
      'Nama Customer': r.nama,
      'No. Telepon': r.telp || '-',
      'Nomor Polisi': r.polisi,
      'Service Advisor': r.advisor || '-',
      'Rencana Penggantian': r.rencana || '-',
      'Daftar Jasa & Sparepart': daftarItem,
      'Total Biaya': total(r)
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(dataToExport)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Inspeksi')
  XLSX.writeFile(workbook, `Data_Inspeksi_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
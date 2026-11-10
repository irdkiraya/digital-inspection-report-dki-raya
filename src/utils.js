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
  const itemCount = r.items ? r.items.length : 0
  
  // LOGIKA DINAMIS: Jika item > 10 (hingga 30 baris), gunakan A4 Portrait agar muat 1 halaman. Jika <= 10, gunakan A5 Portrait.
  const isLargeDoc = itemCount > 10
  const pdfFormat = isLargeDoc ? 'a4' : 'a5'
  const pdfOrientation = 'portrait'

  const doc = new jsPDF({ unit: 'mm', format: pdfFormat, orientation: pdfOrientation })
  const pageWidth = doc.internal.pageSize.getWidth() // Lebar halaman dinamis (A4 = ~210mm, A5 = ~148mm)

  let profile = {}
  try {
    profile = JSON.parse(localStorage.getItem('active_profile')) || {}
  } catch (e) {
    profile = {}
  }

  const namaCabang = profile.nama || 'PT. ASTRA DAIHATSU'
  const alamatCabang = profile.alamat || 'Jl. Siliwangi No. 2, Pondok Benda, Pamulang'
  const kotaCabang = profile.kota ? `, ${profile.kota}` : ''
  const isSerang = namaCabang.toLowerCase().includes('serang')

  // 1. MEMUAT LOGO DARI FOLDER PUBLIC UTAMA (/logo-astra.png)
  try {
    const base64Img = await getBase64ImageFromURL('/logo-astra.png')
    doc.addImage(base64Img, 'PNG', 10, 8, 38, 9)
  } catch (err) {
    doc.setFillColor(235, 242, 250)
    doc.roundedRect(10, 8, 44, 10, 2, 2, 'F')
    doc.setFontSize(9).setFont(undefined, 'bold').setTextColor(20, 70, 140)
    doc.text('ASTRA DAIHATSU', 12, 14)
    doc.setTextColor(0, 0, 0)
  }

  // 2. Header Kiri: Nama & Alamat Cabang
  doc.setFontSize(isLargeDoc ? 9.5 : 9).setFont(undefined, 'bold').text(namaCabang, 10, 21)
  doc.setFontSize(isLargeDoc ? 7 : 6.5).setFont(undefined, 'normal')
  const splitAlamat = doc.splitTextToSize(alamatCabang + kotaCabang, 75)
  doc.text(splitAlamat, 10, 25)

  // 3. Header Kanan: Informasi Estimasi & Daftar Advisor
  const rightAlignX = pageWidth - 10
  doc.setFontSize(isLargeDoc ? 7.5 : 7).setFont(undefined, 'bold')
  doc.text('Informasi Estimasi / Booking Service (H-2)', rightAlignX, 10, { align: 'right' })
  
  doc.setFontSize(isLargeDoc ? 7 : 6.5).setFont(undefined, 'normal')
  let startYRight = 14
  if (advisors && advisors.length > 0) {
    advisors.forEach((adv) => {
      const teleponAdvisor = adv.phone || adv.telp || adv.no_telp || adv.telepon || adv.hp || '-'
      doc.text(`${adv.nama} : ${teleponAdvisor}`, rightAlignX, startYRight, { align: 'right' })
      startYRight += 3.5
    })
  } else {
    doc.text(`${r.advisor || 'Advisor'} : -`, rightAlignX, startYRight, { align: 'right' })
  }

  // 4. Judul Dokumen Tengah
  doc.setFontSize(isLargeDoc ? 11 : 10).setFont(undefined, 'bold').text('INSPECTION REPORT', pageWidth / 2, 34, { align: 'center' })

  // 5. Informasi Utama (Grid 2 Kolom yang responsif terhadap lebar halaman)
  doc.setFontSize(isLargeDoc ? 8 : 7.5).setFont(undefined, 'normal')
  const h = [
    ['Tanggal Pemeriksaan', fd(r.tanggal), 'Nama Customer', r.nama || '-'],
    ['Service Advisor', r.advisor || '-', 'Nomor Telepon', r.telp || '-'],
    ['Nomor Polisi', r.polisi || '-', 'Rencana Penggantian', r.rencana || '-']
  ]
  
  const col2X = pageWidth / 2 + 5
  h.forEach((x, i) => {
    const y = 40 + (i * 4.5)
    doc.text(`${x[0]} : ${x[1]}`, 10, y)
    doc.text(`${x[2]} : ${x[3]}`, col2X, y)
  })

  // 6. Tabel Rincian Jasa & Sparepart (Padding & Font otomatis merapat jika item banyak agar pas 1 halaman A4)
  const tableStartY = 57
  const tableFontSize = isLargeDoc && itemCount > 15 ? 6.5 : (isLargeDoc ? 7.5 : 7.5)
  const cellPadding = isLargeDoc && itemCount > 15 ? 0.8 : (isLargeDoc ? 1.2 : 1.2)

  autoTable(doc, {
    startY: tableStartY,
    head: [['No', 'Jasa/Sparepart', 'Qty', 'Harga Satuan', 'Harga Total']],
    body: [
      ...r.items.map((i, n) => [
        n + 1, 
        i.jasa || '-', 
        i.qty || 1, 
        rp(i.harga), 
        rp((+i.qty || 0) * (+i.harga || 0))
      ]),
      // Kolom TOTAL diposisikan di tengah dengan colspan: 2 dan ditebalkan (bold) beserta nominalnya
      [
        { content: 'TOTAL', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold' } }, 
        { content: '', styles: { fontStyle: 'bold' } }, 
        { content: '', styles: { fontStyle: 'bold' } }, 
        { content: rp(total(r)), styles: { fontStyle: 'bold', halign: 'right' } }
      ]
    ],
    theme: 'grid',
    styles: { fontSize: tableFontSize, cellPadding: cellPadding, lineColor: [150, 170, 200] },
    headStyles: { fillColor: [74, 143, 224] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' }
    },
    margin: { left: 10, right: 10 }
  })

  // 7. Catatan Kaki Bawah & Informasi Rekening Pembayaran (Posisi menyesuaikan tinggi tabel otomatis)
  let currentY = doc.lastAutoTable.finalY + 4
  doc.setFontSize(isLargeDoc ? 7 : 6.5).setFont(undefined, 'normal')
  
  const discountText = isSerang ? '*Bawa kembali form ini & lakukan booking H-2 untuk mendapatkan diskon jasa 10%' : '*Bawa kembali form ini & lakukan booking H-2 untuk mendapatkan diskon jasa 15%'
  doc.text(discountText, 10, currentY)
  
  currentY += 4
  doc.setFont(undefined, 'bold')
  doc.text('Pembayaran dapat ditransfer ke :', 10, currentY)
  currentY += 3.5
  
  if (isSerang) {
    doc.text('Rekening BCA Cabang Serang :', 10, currentY)
    currentY += 3.5
    doc.text('An. PT. Astra International Tbk', 10, currentY)
    currentY += 3.5
    doc.text('No Rekening : 093.302.2533', 10, currentY)
  } else {
    doc.text('Rekening BCA :', 10, currentY)
    currentY += 3.5
    doc.text('An. PT. Astra International Tbk', 10, currentY)
    currentY += 3.5
    doc.text('No Rekening : 764.361.9999', 10, currentY)
  }

  // Simpan File PDF
  doc.save(`inspection-${r.id}-${r.polisi.replace(/\s+/g, '')}.pdf`)
}

export function exportExcel(rows) {
  if (!rows || !rows.length) {
    alert('Tidak ada data untuk diexport.')
    return
  }

  const dataToExport = rows.map((r, index) => {
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
      'Mekanik / Verifikator': r.namaMekanik || r.catatanMekanik || '-',
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
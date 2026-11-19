import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

export const total = (r) => r.items.reduce((s, i) => s + (+i.qty || 0) * (+i.harga || 0), 0)
export const rp = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID')
export const fd = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

// Helper untuk mengecek apakah profil cabang aktif adalah Serang
export function isCabangSerangProfile(profile = null) {
  let p = profile
  if (!p) {
    try {
      p = JSON.parse(localStorage.getItem('active_profile')) || {}
    } catch {
      p = {}
    }
  }
  const email = (p.email || '').toLowerCase()
  const nama = (p.nama || '').toLowerCase()
  const kota = (p.kota || '').toLowerCase()
  const username = (p.username || '').toLowerCase()

  return (
    email.includes('irserang') ||
    email.includes('serang') ||
    nama.includes('serang') ||
    kota.includes('serang') ||
    username.includes('serang')
  )
}

// Helper untuk mengecek apakah profil cabang aktif adalah Pamulang
export function isCabangPamulangProfile(profile = null) {
  let p = profile
  if (!p) {
    try {
      p = JSON.parse(localStorage.getItem('active_profile')) || {}
    } catch {
      p = {}
    }
  }
  const email = (p.email || '').toLowerCase()
  const nama = (p.nama || '').toLowerCase()
  const kota = (p.kota || '').toLowerCase()
  const alamat = (p.alamat || '').toLowerCase()
  const username = (p.username || '').toLowerCase()

  return (
    email.includes('pamulang') ||
    nama.includes('pamulang') ||
    kota.includes('pamulang') ||
    alamat.includes('pamulang') ||
    username.includes('pamulang')
  )
}

// Helper untuk mengecek apakah profil cabang aktif adalah BSD
export function isCabangBsdProfile(profile = null) {
  let p = profile
  if (!p) {
    try {
      p = JSON.parse(localStorage.getItem('active_profile')) || {}
    } catch {
      p = {}
    }
  }
  const email = (p.email || '').toLowerCase()
  const nama = (p.nama || '').toLowerCase()
  const alamat = (p.alamat || '').toLowerCase()
  const username = (p.username || '').toLowerCase()

  return (
    email.includes('bsd') ||
    nama.includes('bsd') ||
    alamat.includes('bsd') ||
    username.includes('bsd')
  )
}

// Helper parsing daftar foto dari kolom foto_url (JSON array atau single URL string)
export function parseInspectionPhotos(fotoUrlField) {
  if (!fotoUrlField) return []
  if (Array.isArray(fotoUrlField)) return fotoUrlField.filter(Boolean)
  try {
    const parsed = JSON.parse(fotoUrlField)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    // Fallback jika berupa string URL tunggal
  }
  return typeof fotoUrlField === 'string' && fotoUrlField.trim() !== '' ? [fotoUrlField.trim()] : []
}

// Helper untuk mengubah gambar lokal public maupun URL Storage menjadi Base64 untuk jsPDF
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
  const photos = parseInspectionPhotos(r.foto_url)
  const hasPhoto = photos.length > 0

  // Tanpa foto -> A5 Landscape (210mm x 148mm)
  // Ada foto   -> A4 Portrait  (210mm x 297mm)
  const doc = new jsPDF({
    unit: 'mm',
    format: hasPhoto ? 'a4' : 'a5',
    orientation: hasPhoto ? 'portrait' : 'landscape'
  })

  let profile = {}
  try {
    profile = JSON.parse(localStorage.getItem('active_profile')) || {}
  } catch (e) {
    profile = {}
  }

  const isSerang = isCabangSerangProfile(profile)
  const isPamulang = isCabangPamulangProfile(profile)
  const isBsd = isCabangBsdProfile(profile)

  // Diskon 10% untuk Serang, Pamulang, dan BSD; cabang lain 15%
  const diskonJasa = isSerang || isPamulang || isBsd ? '10%' : '10%'
  const noRekeningBca = isSerang
    ? '093.3022533'
    : isBsd
      ? '4970-836-000'
      : '764.361.9999'

  const namaCabang = profile.nama || 'PT. ASTRA DAIHATSU'
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

  // 3. Header Kanan: Informasi Estimasi & Daftar Advisor
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

  // 6. Tabel Rincian Jasa & Sparepart (Maksimal 30 baris untuk semua cabang)
  const itemsToPrint = (r.items || []).slice(0, 30)
  autoTable(doc, {
    startY: 65,
    head: [['No', 'Jasa/Sparepart', 'Qty', 'Harga Satuan', 'Harga Total']],
    body: [
      ...itemsToPrint.map((i, n) => [
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

  // 7. Catatan Kaki Bawah & Informasi Rekening Pembayaran (Dinamis sesuai Cabang)
  let currentY = doc.lastAutoTable.finalY + 6
  const pageHeight = doc.internal.pageSize.getHeight()

  if (currentY + 22 > pageHeight) {
    doc.addPage()
    currentY = 14
  }

  doc.setFontSize(7.5).setFont(undefined, 'normal')
  doc.text(`*Bawa kembali form ini & lakukan booking H-2 untuk mendapatkan diskon jasa ${diskonJasa}`, 10, currentY)
  
  currentY += 5
  doc.setFont(undefined, 'bold')
  doc.text('Pembayaran dapat ditransfer ke :', 10, currentY)
  currentY += 4
  doc.text('Rekening BCA :', 10, currentY)
  currentY += 4
  doc.text('An. PT. Astra International Tbk', 10, currentY)
  currentY += 4
  doc.text(`No Rekening : ${noRekeningBca}`, 10, currentY)

  // 8. JUDUL "FOTO KERUSAKAN" & KOTAK FOTO 10x10 CM (KIRI & KANAN, AUTO LEMBAR BARU)
  if (hasPhoto) {
    const photoWidth = 100  // 10 cm
    const photoHeight = 100 // 10 cm
    const leftX = 4         // Sisi kiri
    const rightX = 106      // Sisi kanan
    const outerBoxX = 3
    const outerBoxWidth = 204

    currentY += 7 // Tepat di bawah teks No Rekening

    // Jika baris foto pertama tidak muat di halaman saat ini, pindah ke lembar baru
    if (currentY + photoHeight + 12 > pageHeight) {
      doc.addPage()
      currentY = 14
    }

    // Judul rata tengah tepat di atas foto
    doc.setFontSize(10).setFont(undefined, 'bold')
    doc.text('FOTO KERUSAKAN', 105, currentY, { align: 'center' })
    currentY += 4

    for (let i = 0; i < photos.length; i += 2) {
      // Jika baris foto berikutnya tidak muat di sisa halaman, buat lembar baru
      if (i > 0 && currentY + photoHeight + 10 > pageHeight) {
        doc.addPage()
        currentY = 14
        doc.setFontSize(10).setFont(undefined, 'bold')
        doc.text('FOTO KERUSAKAN (Lanjutan)', 105, currentY, { align: 'center' })
        currentY += 4
      }

      // Kotak pembungkus luar untuk pasangan foto kiri & kanan
      doc.setDrawColor(150, 170, 200)
      doc.setLineWidth(0.3)
      doc.rect(outerBoxX, currentY - 1, outerBoxWidth, photoHeight + 2)

      // Foto Sisi Kiri (10 x 10 cm)
      try {
        const leftBase64 = await getBase64ImageFromURL(photos[i])
        doc.addImage(leftBase64, 'PNG', leftX, currentY, photoWidth, photoHeight)
        doc.rect(leftX, currentY, photoWidth, photoHeight)
      } catch (err) {
        console.error(`Gagal memuat foto ke-${i + 1}:`, err)
      }

      // Foto Sisi Kanan (10 x 10 cm) jika ada foto ke-2, ke-4, dst.
      if (i + 1 < photos.length) {
        try {
          const rightBase64 = await getBase64ImageFromURL(photos[i + 1])
          doc.addImage(rightBase64, 'PNG', rightX, currentY, photoWidth, photoHeight)
          doc.rect(rightX, currentY, photoWidth, photoHeight)
        } catch (err) {
          console.error(`Gagal memuat foto ke-${i + 2}:`, err)
        }
      }

      currentY += photoHeight + 5
    }
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

import { supabase } from '../supabase'

/**
 * Mengambil daftar Service Advisor berdasarkan id_profile (Cabang yang aktif)
 */
export async function fetchAdvisorsByProfile(profileId) {
  try {
    const { data, error } = await supabase
      .from('advisor')
      .select('nama,phone')
      .eq('id_profile', profileId)
      .order('nama', { ascending: true })

    if (error) throw error
    return { data: data || [], error: null }
  } catch (err) {
    console.error('Gagal memuat advisor:', err.message)
    return { data: [], error: err.message }
  }
}

/**
 * Upload satu file foto inspeksi ke Supabase Storage dan kembalikan Public URL-nya
 */
export async function uploadInspectionPhoto(file, profileId) {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${profileId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('inspection-photos')
      .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('inspection-photos')
      .getPublicUrl(fileName)

    return { url: data.publicUrl, error: null }
  } catch (err) {
    console.error('Gagal upload foto:', err.message)
    return { url: null, error: err.message }
  }
}

/**
 * Menyimpan data inspeksi baru atau memperbarui data yang sudah ada (Mode Edit)
 */
export async function saveInspectionRecord(record, profileId, isEdit = false) {
  try {
    // 1. Validasi relasi item jasa (Maksimal 30 baris)
    const validItems = record.items.filter(i => i.jasa && i.jasa.trim() !== '').slice(0, 30)
    if (!validItems.length) {
      return { success: false, error: 'Minimal harus ada satu baris jasa atau sparepart yang diisi.' }
    }

    // Simpan array foto sebagai JSON string di kolom foto_url (null jika kosong)
    const serializedPhotos =
      Array.isArray(record.photos) && record.photos.length > 0
        ? JSON.stringify(record.photos)
        : (record.foto_url || null)

    if (isEdit) {
      // --- PROSES UPDATE / EDIT ---
      const { error: headerErr } = await supabase
        .from('inspeksi')
        .update({
          tanggal: record.tanggal,
          nama: record.nama.trim(),
          advisor: record.advisor,
          telp: record.telp,
          namaMekanik: record.namaMekanik,
          polisi: record.polisi.toUpperCase(),
          rencana: record.rencana,
          foto_url: serializedPhotos
        })
        .eq('id', record.id)
        .eq('id_profile', profileId)

      if (headerErr) throw headerErr

      // Hapus item lama yang terikat pada id inspeksi ini, lalu masukkan ulang item baru
      const { error: deleteErr } = await supabase
        .from('inspection_items')
        .delete()
        .eq('inspeksi_id', record.id)

      if (deleteErr) throw deleteErr

      const itemsToInsert = validItems.map(item => ({
        inspeksi_id: record.id,
        jasa: item.jasa.trim(),
        qty: Number(item.qty) || 1,
        harga: Number(item.harga) || 0
      }))

      const { error: itemsErr } = await supabase
        .from('inspection_items')
        .insert(itemsToInsert)

      if (itemsErr) throw itemsErr

      return { success: true, message: `Laporan inspeksi nomor ${record.id} berhasil diperbarui.` }

    } else {
      // --- PROSES INSERT / TAMBAH BARU ---
      const inspectionId = record.id || ('INS-' + Date.now().toString().slice(-6))

      const { error: headerErr } = await supabase
        .from('inspeksi')
        .insert([{
          id: inspectionId,
          id_profile: profileId,
          tanggal: record.tanggal,
          nama: record.nama.trim(),
          advisor: record.advisor,
          telp: record.telp,
          namaMekanik: record.namaMekanik,
          polisi: record.polisi.toUpperCase(),
          rencana: record.rencana,
          foto_url: serializedPhotos
        }])

      if (headerErr) throw headerErr

      const itemsToInsert = validItems.map(item => ({
        inspeksi_id: inspectionId,
        jasa: item.jasa.trim(),
        qty: Number(item.qty) || 1,
        harga: Number(item.harga) || 0
      }))

      const { error: itemsErr } = await supabase
        .from('inspection_items')
        .insert(itemsToInsert)

      if (itemsErr) throw itemsErr

      return { success: true, message: `Laporan inspeksi baru (${inspectionId}) berhasil disimpan ke database.` }
    }

  } catch (err) {
    console.error('Database Error:', err)
    return { 
      success: false, 
      error: err.message || 'Terjadi kesalahan saat berkomunikasi dengan server database.' 
    }
  }
}

/**
 * Menghapus data laporan inspeksi berdasarkan ID
 */
export async function deleteInspectionRecord(id, profileId) {
  try {
    // 1. Hapus item jasa terkait terlebih dahulu
    const { error: itemErr } = await supabase
      .from('inspection_items')
      .delete()
      .eq('inspeksi_id', id)

    if (itemErr) throw itemErr

    // 2. Hapus header inspeksi utama
    const { error: headerErr } = await supabase
      .from('inspeksi')
      .delete()
      .eq('id', id)
      .eq('id_profile', profileId)

    if (headerErr) throw headerErr

    return { success: true, message: 'Data inspeksi berhasil dihapus.' }
  } catch (err) {
    console.error('Gagal menghapus data:', err.message)
    return { success: false, error: err.message }
  }
}

/**
 * Mengambil statistik kumulatif (Actual/Realtime dari awal s/d tanggal update)
 * untuk seluruh cabang berdasarkan id_profile
 */
export async function fetchCumulativeStats(profileId, upToDate = null) {
  try {
    // 1. Hitung Total Inspection Report dari awal sampai tanggal update
    let queryReports = supabase
      .from('inspeksi')
      .select('id', { count: 'exact', head: true })
      .eq('id_profile', profileId)

    if (upToDate) {
      queryReports = queryReports.lte('tanggal', upToDate)
    }

    // 2. Hitung Total Kedatangan ter-update dari awal sampai tanggal update
    let queryKedatangan = supabase
      .from('kedatangan')
      .select('id', { count: 'exact', head: true })
      .eq('id_profile', profileId)

    if (upToDate) {
      queryKedatangan = queryKedatangan.lte('tanggal', upToDate)
    }

    const [resReports, resKedatangan] = await Promise.all([queryReports, queryKedatangan])

    const totalReports = resReports.count || 0
    const totalKedatangan = resKedatangan.count || 0
    const persentase = totalReports > 0 
      ? Math.round((totalKedatangan / totalReports) * 100) 
      : 0

    return {
      totalReports,
      totalKedatangan,
      persentase,
      error: null
    }
  } catch (err) {
    console.error('Gagal memuat statistik kumulatif:', err.message)
    return {
      totalReports: 0,
      totalKedatangan: 0,
      persentase: 0,
      error: err.message
    }
  }
}

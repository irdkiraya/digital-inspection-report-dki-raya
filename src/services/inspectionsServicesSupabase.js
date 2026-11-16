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
 * Menyimpan data inspeksi baru atau memperbarui data yang sudah ada (Mode Edit)
 */
export async function saveInspectionRecord(record, profileId, isEdit = false) {
  try {
    // 1. Validasi relasi item jasa
    const validItems = record.items.filter(i => i.jasa && i.jasa.trim() !== '')
    if (!validItems.length) {
      return { success: false, error: 'Minimal harus ada satu baris jasa atau sparepart yang diisi.' }
    }

    if (isEdit) {
      // --- PROSES UPDATE / EDIT ---
      // Update data utama header inspeksi
      const { error: headerErr } = await supabase
        .from('inspeksi')
        .update({
          tanggal: record.tanggal,
          nama: record.nama.trim(),
          advisor: record.advisor,
          telp: record.telp,
          namaMekanik: record.namaMekanik,
          polisi: record.polisi.toUpperCase(),
          rencana: record.rencana
        })
        .eq('id', record.id)
        .eq('id_profile', profileId)

      if (headerErr) throw headerErr

      // Strategi item: Hapus item lama yang terikat pada id inspeksi ini, lalu masukkan ulang item yang baru
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
      // Generate ID otomatis (misal: INS-0001, dst atau gunakan timestamp/random string unik)
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
          rencana: record.rencana
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
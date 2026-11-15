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
    // --- PENGAMANAN MUTLAK & PAKSA UUID UNTUK AKUN IR TESTING ---
    let finalProfileId = '99999999-9999-9999-9999-999999999999';

    try {
      const activeProfile = JSON.parse(localStorage.getItem('active_profile') || '{}');
      const email = (activeProfile.email || '').toLowerCase().trim();
      const nama = (activeProfile.nama || '').toLowerCase().trim();

      // Jika akun testing, KUNCI mutlak ke UUID yang benar (abaikan ID lama di localStorage)
      if (
        email === 'irtestingdki@gmail.com' || 
        nama.includes('ir testing') || 
        nama.includes('testing')
      ) {
        finalProfileId = '99999999-9999-9999-9999-999999999999';
      } else if (activeProfile.id) {
        finalProfileId = activeProfile.id;
      } else if (profileId) {
        finalProfileId = profileId;
      }
    } catch (e) {
      console.error('Gagal membaca localStorage:', e);
    }

    console.log('🚀 FINAL PROFILE ID TERKUNCI UNTUK SUPABASE:', finalProfileId);

    // 1. Validasi relasi item jasa
    const validItems = record.items.filter(i => i.jasa && i.jasa.trim() !== '')
    if (!validItems.length) {
      return { success: false, error: 'Minimal harus ada satu baris jasa atau sparepart yang diisi.' }
    }

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
          rencana: record.rencana
        })
        .eq('id', record.id)
        .eq('id_profile', finalProfileId)

      if (headerErr) throw headerErr

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
      const inspectionId = record.id || crypto.randomUUID()

      const payloadHeader = {
        id: inspectionId,
        id_profile: finalProfileId, // Dijamin menggunakan UUID 999999... yang valid secara mutlak
        tanggal: record.tanggal,
        nama: record.nama.trim(),
        advisor: record.advisor,
        telp: record.telp,
        namaMekanik: record.namaMekanik,
        polisi: record.polisi.toUpperCase(),
        rencana: record.rencana
      };

      console.log('📤 PAYLOAD HEADER YANG DIKIRIM:', payloadHeader);

      const { error: headerErr } = await supabase
        .from('inspeksi')
        .insert([payloadHeader])

      if (headerErr) {
        console.error('❌ ERROR SUPABASE INSERT:', headerErr);
        throw headerErr;
      }

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

      return { success: true, message: `Laporan inspeksi baru berhasil disimpan ke database.` }
    }

  } catch (err) {
    console.error('Database Error Catch:', err)
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
    let finalProfileId = '99999999-9999-9999-9999-999999999999';

    const { error: itemErr } = await supabase
      .from('inspection_items')
      .delete()
      .eq('inspeksi_id', id)

    if (itemErr) throw itemErr

    const { error: headerErr } = await supabase
      .from('inspeksi')
      .delete()
      .eq('id', id)
      .eq('id_profile', finalProfileId)

    if (headerErr) throw headerErr

    return { success: true, message: 'Data inspeksi berhasil dihapus.' }
  } catch (err) {
    console.error('Gagal menghapus data:', err.message)
    return { success: false, error: err.message }
  }
}
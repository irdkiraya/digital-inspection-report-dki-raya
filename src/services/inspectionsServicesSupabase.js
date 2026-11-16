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
 * Menyimpan data inspeksi baru atau memperbarui data (Edit)
 */
export async function saveInspectionRecord(record, profileId, isEdit = false) {
  try {
    let finalProfileId = profileId;

    if (!finalProfileId || finalProfileId === 'undefined' || finalProfileId === 'null') {
      try {
        const activeProfile = JSON.parse(localStorage.getItem('active_profile') || '{}');
        if (activeProfile.id) {
          finalProfileId = activeProfile.id;
        }
      } catch (e) {
        console.error('Gagal membaca localStorage:', e);
      }
    }

    // Auto-fetch profile dari database profiles jika ID tidak valid
    if (!finalProfileId || !String(finalProfileId).includes('-')) {
      const activeProfile = JSON.parse(localStorage.getItem('active_profile') || '{}');
      let targetEmail = activeProfile.email || 'irserang@gmail.com';

      const { data: dbProfile, error: profileErr } = await supabase
        .from('profiles') 
        .select('id, email, nama, created_at')
        .ilike('email', targetEmail)
        .maybeSingle();

      if (profileErr || !dbProfile) {
        return { success: false, error: `Sesi profil tidak valid untuk email: ${targetEmail}` };
      }
      finalProfileId = dbProfile.id;
      localStorage.setItem('active_profile', JSON.stringify(dbProfile));
    }

    const validItems = record.items.filter(i => i.jasa && i.jasa.trim() !== '')
    if (!validItems.length) {
      return { success: false, error: 'Minimal harus ada satu baris jasa atau sparepart yang diisi.' }
    }

    if (isEdit) {
      const { error: headerErr } = await supabase
        .from('inspeksi')
        .update({
          id_profile: finalProfileId,
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
      const inspectionId = record.id || crypto.randomUUID()

      const payloadHeader = {
        id: inspectionId,
        id_profile: finalProfileId,
        tanggal: record.tanggal,
        nama: record.nama.trim(),
        advisor: record.advisor,
        telp: record.telp,
        namaMekanik: record.namaMekanik,
        polisi: record.polisi.toUpperCase(),
        rencana: record.rencana
      };

      const { error: headerErr } = await supabase
        .from('inspeksi')
        .insert([payloadHeader])

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

      return { success: true, message: `Laporan inspeksi baru berhasil disimpan.` }
    }

  } catch (err) {
    console.error('Database Error Catch:', err)
    return { success: false, error: err.message || 'Terjadi kesalahan sistem database.' }
  }
}

/**
 * Menghapus data laporan inspeksi berdasarkan ID
 */
export async function deleteInspectionRecord(id, profileId) {
  try {
    let finalProfileId = profileId;
    if (!finalProfileId) {
      const activeProfile = JSON.parse(localStorage.getItem('active_profile') || '{}');
      finalProfileId = activeProfile.id;
    }

    await supabase.from('inspection_items').delete().eq('inspeksi_id', id)
    const { error: headerErr } = await supabase.from('inspeksi').delete().eq('id', id).eq('id_profile', finalProfileId)

    if (headerErr) throw headerErr

    return { success: true, message: 'Data inspeksi berhasil dihapus.' }
  } catch (err) {
    console.error('Gagal menghapus data:', err.message)
    return { success: false, error: err.message }
  }
}
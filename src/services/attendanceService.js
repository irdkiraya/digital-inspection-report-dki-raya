import { supabase } from '../supabase'

// Ambil data kedatangan berdasarkan tanggal dan cabang
export async function fetchAttendanceByDate(profileId, tanggal) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('id_profile', profileId)
    .eq('tanggal', tanggal)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data, error: null }
}

// Ambil statistik kumulatif Actual/Realtime (dari awal s/d upToDate) untuk cabang yang aktif
export async function fetchCumulativeAttendanceStats(profileId, upToDate) {
  try {
    // 1. Hitung Total Inspection Report dari awal s/d tanggal update
    const { count: totalReports, error: errReports } = await supabase
      .from('inspeksi')
      .select('id', { count: 'exact', head: true })
      .eq('id_profile', profileId)
      .lte('tanggal', upToDate)

    if (errReports) throw errReports

    // 2. Hitung Total Kedatangan (status_hadir = true) dari awal s/d tanggal update
    const { count: totalKedatangan, error: errAtt } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('id_profile', profileId)
      .eq('status_hadir', true)
      .lte('tanggal', upToDate)

    if (errAtt) throw errAtt

    return {
      totalReports: totalReports || 0,
      totalKedatangan: totalKedatangan || 0,
      error: null
    }
  } catch (err) {
    console.error('Gagal memuat statistik kedatangan kumulatif:', err.message)
    return {
      totalReports: 0,
      totalKedatangan: 0,
      error: err.message
    }
  }
}

// Cek apakah nomor polisi sudah terdaftar di inspeksi untuk menarik datanya
export async function checkInspectionByPolisi(profileId, polisi) {
  const { data, error } = await supabase
    .from('inspeksi')
    .select(`*, items:inspection_items(*)`)
    .eq('id_profile', profileId)
    .ilike('polisi', polisi.trim())
    .limit(1)

  if (error || !data || data.length === 0) return null
  return data[0]
}

// Simpan data kedatangan baru
export async function insertAttendance(profileId, tanggal, polisi, statusHadir) {
  const { error } = await supabase
    .from('attendance')
    .insert([{
      id_profile: profileId,
      tanggal,
      polisi: polisi.toUpperCase().trim(),
      status_hadir: statusHadir
    }])

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Nomor polisi ini sudah diinput untuk tanggal tersebut.' }
    }
    return { success: false, error: error.message }
  }
  return { success: true }
}

// Update status checklist kedatangan
export async function updateAttendanceStatus(id, statusHadir) {
  const { error } = await supabase
    .from('attendance')
    .update({ status_hadir: statusHadir })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

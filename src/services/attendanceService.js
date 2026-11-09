import { supabase } from '../supabase'

// Ambil data kehadiran berdasarkan tanggal dan cabang
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

// Simpan data kehadiran baru
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

// Update status checklist hadir
export async function updateAttendanceStatus(id, statusHadir) {
  const { error } = await supabase
    .from('attendance')
    .update({ status_hadir: statusHadir })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
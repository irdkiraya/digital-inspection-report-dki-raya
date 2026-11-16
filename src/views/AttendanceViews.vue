<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchAttendanceByDate, checkInspectionByPolisi, insertAttendance, updateAttendanceStatus } from '../services/attendanceService'

const emit = defineEmits(['detail'])

const currentDate = ref(new Date().toISOString().slice(0, 10))
const attendanceList = ref([])
const loading = ref(false)
const showModal = ref(false)

// State Form Pop-up
const formPolisi = ref('')
const formHadir = ref(true)
const formError = ref('')
const previewInspection = ref(null)

const getActiveProfileId = () => {
  try {
    const profile = JSON.parse(localStorage.getItem('active_profile'))
    return profile ? profile.id : null
  } catch {
    return null
  }
}

async function loadAttendance() {
  const profileId = getActiveProfileId()
  if (!profileId) return

  loading.value = true
  const { data } = await fetchAttendanceByDate(profileId, currentDate.value)
  attendanceList.value = data
  loading.value = false
}

onMounted(() => {
  loadAttendance()
})

// Hitung Statistik Persentase
const totalBooking = computed(() => attendanceList.value.length)
const totalHadir = computed(() => attendanceList.value.filter(i => i.status_hadir).length)
const percentage = computed(() => {
  if (totalBooking.value === 0) return 0
  return Math.round((totalHadir.value / totalBooking.value) * 100)
})

// Validasi Nopol saat diketik di Pop-up untuk preview data inspeksi
async function handlePolisiInput() {
  formError.value = ''
  previewInspection.value = null
  if (formPolisi.value.length < 3) return

  const profileId = getActiveProfileId()
  const result = await checkInspectionByPolisi(profileId, formPolisi.value)
  if (result) {
    previewInspection.value = result
  }
}

// Simpan Kehadiran Baru
async function handleSaveAttendance() {
  formError.value = ''
  if (!formPolisi.value.trim()) {
    formError.value = 'Nomor polisi wajib diisi.'
    return
  }

  const profileId = getActiveProfileId()
  const res = await insertAttendance(profileId, currentDate.value, formPolisi.value, formHadir.value)

  if (!res.success) {
    formError.value = res.error
  } else {
    showModal.value = false
    formPolisi.value = ''
    previewInspection.value = null
    loadAttendance()
  }
}

// Toggle Checklist Hadir Langsung dari Tabel
async function toggleHadir(item) {
  const newStatus = !item.status_hadir
  const res = await updateAttendanceStatus(item.id, newStatus)
  if (res.success) {
    item.status_hadir = newStatus
  }
}

// Klik Nopol untuk memicu Detail Modal dari Inspeksi
async function showDetailByPolisi(polisi) {
  const profileId = getActiveProfileId()
  const result = await checkInspectionByPolisi(profileId, polisi)
  if (result) {
    emit('detail', result)
  } else {
    alert('Data detail inspeksi tidak ditemukan untuk nomor polisi ini.')
  }
}
</script>

<template>
  <div class="p-4 md:p-8 space-y-6">
    <!-- Header & Tombol Tambah -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-extrabold text-slate-800 tracking-tight">Kedatangan Pelanggan (Attendance)</h1>
        <p class="text-xs text-slate-500 mt-0.5">Kelola dan pantau persentase kedatangan harian.</p>
      </div>

      <div class="flex items-center gap-3">
        <input 
          type="date" 
          v-model="currentDate" 
          @change="loadAttendance"
          class="bg-white border border-slate-300 rounded-2xl px-4 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:border-blue-500"
        />
        <button 
          @click="showModal = true" 
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition shadow-sm flex items-center gap-2"
        >
          <i class="fa-solid fa-plus text-xs"></i>
          <span>Tambah Kehadiran</span>
        </button>
      </div>
    </div>

    <!-- Statistik Card & Persentase -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Inspection Report</p>
          <p class="text-2xl font-extrabold text-slate-900 mt-1">{{ totalBooking }} <span class="text-xs font-normal text-slate-500">orang</span></p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-lg font-bold">
          <i class="fa-solid fa-calendar-check"></i>
        </div>
      </div>

      <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hadir</p>
          <p class="text-2xl font-extrabold text-emerald-600 mt-1">{{ totalHadir }} <span class="text-xs font-normal text-slate-500">orang</span></p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
          <i class="fa-solid fa-user-check"></i>
        </div>
      </div>

      <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Persentase Kehadiran</p>
          <p class="text-2xl font-extrabold text-blue-600 mt-1">{{ percentage }}%</p>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
          <i class="fa-solid fa-chart-pie"></i>
        </div>
      </div>
    </div>

    <!-- Tabel List Kehadiran -->
    <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <th class="py-3.5 px-5">No. Polisi</th>
              <th class="py-3.5 px-5">Tanggal</th>
              <th class="py-3.5 px-5 text-center">Kedatangan</th>
              <th class="py-3.5 px-5 text-right">Aksi Detail</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs">
            <tr v-for="item in attendanceList" :key="item.id" class="hover:bg-sky-50/40 transition">
              <td class="py-4 px-5">
                <button @click="showDetailByPolisi(item.polisi)" class="font-extrabold text-blue-600 hover:underline bg-sky-50 px-3 py-1 rounded-xl border border-sky-200">
                  {{ item.polisi }}
                </button>
              </td>
              <td class="py-4 px-5 font-semibold text-slate-700">{{ item.tanggal }}</td>
              <td class="py-4 px-5 text-center">
                <button 
                  @click="toggleHadir(item)"
                  class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition shadow-2xs"
                  :class="item.status_hadir ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-500 border border-slate-200'"
                >
                  <i :class="item.status_hadir ? 'fa-solid fa-check mr-1 text-emerald-600' : 'fa-solid fa-xmark mr-1 text-slate-400'"></i>
                  {{ item.status_hadir ? 'Hadir' : 'Belum Hadir' }}
                </button>
              </td>
              <td class="py-4 px-5 text-right">
                <button @click="showDetailByPolisi(item.polisi)" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition">
                  Riwayat Inspeksi <i class="fa-solid fa-arrow-right ml-1"></i>
                </button>
              </td>
            </tr>
            <tr v-if="!attendanceList.length">
              <td colspan="4" class="text-center py-10 text-slate-400 text-xs">
                Belum ada data kehadiran pada tanggal ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL TAMBAH KEHADIRAN -->
    <div v-if="showModal" class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div class="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-xl border border-slate-200">
        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 class="font-extrabold text-slate-900 text-sm">Tambah Kehadiran Booking</h3>
          <button @click="showModal = false" class="text-slate-400 hover:text-slate-700">
            <i class="fa-solid fa-xmark text-base"></i>
          </button>
        </div>

        <div class="space-y-4">
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Tanggal (Otomatis)</label>
            <input type="date" :value="currentDate" disabled class="w-full bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-500 font-bold" />
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nomor Polisi / Plat Kendaraan</label>
            <input 
              type="text" 
              v-model="formPolisi" 
              @input="handlePolisiInput"
              placeholder="Contoh: B 1234 XYZ" 
              class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 uppercase focus:outline-none focus:border-blue-600 transition" 
            />
          </div>

          <!-- Preview Info jika Nopol ditemukan di tabel inspeksi -->
          <div v-if="previewInspection" class="p-3 bg-sky-50 rounded-2xl border border-sky-200 text-xs space-y-1">
            <p class="font-bold text-sky-900"><i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> Data Kendaraan Ditemukan:</p>
            <p class="text-slate-700">Customer: <span class="font-bold">{{ previewInspection.nama }}</span></p>
            <p class="text-slate-700">Advisor: <span class="font-bold">{{ previewInspection.advisor }}</span></p>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <input type="checkbox" id="hadirCheck" v-model="formHadir" class="w-4 h-4 text-blue-600 rounded" />
            <label for="hadirCheck" class="text-xs font-bold text-slate-700 cursor-pointer">Langsung Checklist Hadir</label>
          </div>

          <div v-if="formError" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold">
            {{ formError }}
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button @click="showModal = false" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">Batal</button>
          <button @click="handleSaveAttendance" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200">Simpan Kehadiran</button>
        </div>
      </div>
    </div>

  </div>
</template>
<script setup>
import { reactive, ref, watch, onMounted, computed } from 'vue'
import { rp, total } from '../utils'
import { fetchAdvisorsByProfile, saveInspectionRecord } from '../services/inspectionsServicesSupabase'

const props = defineProps({ initialData: Object })
const emit = defineEmits(['save'])

let k = 0
const row = (jasa = '', qty = 1, harga = 0) => ({ k: ++k, jasa, qty, harga })

const blank = () => ({ 
  tanggal: new Date().toISOString().slice(0, 10), 
  nama: '', 
  advisor: '', 
  namaMekanik: '', 
  catatanMekanik: '', // Data khusus rekap Excel / export, tidak masuk PDF
  telp: '', 
  polisi: '', 
  rencana: '', 
  items: [row()] 
})

const f = reactive(blank())
const advisorsList = ref([])
const message = ref({ text: '', type: '' })
const loading = ref(false)
const isSerangBranch = ref(false)

const getActiveProfileId = () => {
  try {
    const profile = JSON.parse(localStorage.getItem('active_profile'))
    return profile ? profile.id : null
  } catch {
    return null
  }
}

onMounted(async () => {
  let currentProfileName = ''
  
  // Ambil nama profil aktif dari localStorage untuk mendeteksi cabang
  try {
    const profile = JSON.parse(localStorage.getItem('active_profile'))
    currentProfileName = profile ? (profile.nama || profile.branch_name || '').toLowerCase() : ''
  } catch {
    currentProfileName = ''
  }

  // Tentukan apakah cabang Serang
  isSerangBranch.value = currentProfileName.includes('serang')

  // Tentukan daftar SA secara tegas berdasarkan nama profil/cabang yang sedang aktif login
  if (isSerangBranch.value) {
    advisorsList.value = [
      { nama: 'Firman Faturahman' },
      { nama: 'Ira Mutiara S. Situmorang' }
    ]
  } else {
    // Default / khusus untuk Citra Raya
    advisorsList.value = [
      { nama: 'Fatha Arighi' },
      { nama: 'Achmad Firdaus' },
      { nama: 'Mekanik DMS' }
    ]
  }
})

watch(() => props.initialData, (val) => {
  if (val) {
    f.id = val.id
    f.tanggal = val.tanggal
    f.nama = val.nama
    f.advisor = val.advisor
    f.namaMekanik = val.namaMekanik || ''
    f.catatanMekanik = val.catatanMekanik || ''
    f.telp = val.telp
    f.polisi = val.polisi
    f.rencana = val.rencana
    f.items = val.items && val.items.length ? val.items.map(i => row(i.jasa, i.qty, i.harga)) : [row()]
  } else {
    Object.assign(f, blank())
  }
}, { immediate: true })

const reset = () => { 
  Object.assign(f, blank())
  message.value = { text: '', type: '' }
}

async function save() {
  message.value = { text: '', type: '' }
  const items = f.items.filter((i) => i.jasa.trim())

  if (!f.nama.trim() || !f.polisi.trim() || !f.tanggal || !items.length) {
    message.value = { 
      text: 'Mohon lengkapi Tanggal Pemeriksaan, Nama Customer, Nomor Polisi, dan minimal satu baris Jasa/Sparepart.', 
      type: 'error' 
    }
    return
  }

  const profileId = getActiveProfileId()
  if (!profileId) {
    message.value = { text: 'Sesi cabang tidak ditemukan. Silakan login ulang.', type: 'error' }
    return
  }

  loading.value = true

  const recordPayload = { ...f, items }
  const result = await saveInspectionRecord(recordPayload, profileId, !!props.initialData)

  loading.value = false

  if (!result.success) {
    message.value = { text: result.error, type: 'error' }
  } else {
    message.value = { text: result.message, type: 'success' }
    setTimeout(() => {
      emit('save', recordPayload)
    }, 1000)
  }
}
</script>

<template>
  <div class="p-4 md:p-8 space-y-6">
    <div>
      <h1 class="text-xl font-extrabold text-slate-900 tracking-tight">
        {{ initialData ? 'Edit Inspection Report' : 'Input Inspection Report' }}
      </h1>
      <p class="text-xs text-slate-500 mt-0.5">Perbarui data header dan daftar jasa/sparepart sesuai kebutuhan.</p>
    </div>

    <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 md:p-8 space-y-6">
      
      <div v-if="message.text" :class="message.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'" class="p-3.5 border rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-2xs transition-all">
        <i :class="message.type === 'error' ? 'fa-solid fa-circle-exclamation text-rose-600' : 'fa-solid fa-circle-check text-emerald-600'"></i>
        <span>{{ message.text }}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Tanggal Pemeriksaan</label>
          <input type="date" v-model="f.tanggal" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nama Customer</label>
          <input v-model="f.nama" placeholder="Nama customer" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Service Advisor</label>
          <select v-model="f.advisor" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs">
            <option value="" disabled>-- Pilih Service Advisor --</option>
            <option v-for="(adv, idx) in advisorsList" :key="idx" :value="adv.nama">
              {{ adv.nama }}
            </option>
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Mekanik</label>
          <input v-model="f.namaMekanik" placeholder="Nama mekanik yang menangani" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nomor Telepon</label>
          <input type="tel" v-model="f.telp" placeholder="08xxxxxxxxxx" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nomor Polisi</label>
          <input v-model="f.polisi" placeholder="B 1234 XYZ" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 uppercase placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Rencana Penggantian</label>
          <input v-model="f.rencana" placeholder="Mis. 20 Nov 2026 / 5.000 km" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
      </div>

      <!-- Catatan Internal Mekanik (Khusus Rekap Excel & Ekspor XC - Tidak Tercetak di PDF) -->
      <div class="space-y-1.5 p-4 bg-amber-50/50 border border-amber-200/80 rounded-2xl">
        <label class="text-[11px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
          <i class="fa-solid fa-clipboard-user text-amber-600"></i>
          Catatan / Verifikasi Mekanik (Khusus Rekap Excel - Tidak Tercetak di PDF)
        </label>
        <input v-model="f.catatanMekanik" placeholder="Ketik keterangan atau nama verifikator mekanik untuk laporan internal..." class="w-full bg-white border border-amber-300 rounded-xl px-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 transition shadow-2xs" />
      </div>

      <div class="space-y-3 pt-4 border-t border-slate-200">
        <h3 class="font-bold text-xs text-slate-900 uppercase tracking-wide">Daftar Jasa & Sparepart</h3>

        <div class="space-y-2.5">
          <div v-for="(it, i) in f.items" :key="it.k" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 hidden sm:flex">{{ i + 1 }}</span>
            <input v-model="it.jasa" placeholder="Nama Jasa / Sparepart" class="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs" />
            <div class="flex items-center gap-2">
              <input type="number" step="any" min="0" v-model.number="it.qty" placeholder="Qty" class="w-20 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 text-center focus:outline-none focus:border-blue-600 shadow-2xs" />
              <input type="number" min="0" v-model.number="it.harga" placeholder="Harga Satuan" class="w-28 sm:w-32 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 text-right focus:outline-none focus:border-blue-600 shadow-2xs" />
            </div>
            <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
              <span class="font-extrabold text-xs text-slate-900 w-28 text-right">{{ rp((it.qty || 0) * (it.harga || 0)) }}</span>
              <button type="button" :disabled="f.items.length === 1" @click="f.items.splice(i, 1)" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition shrink-0 shadow-2xs">
                <i class="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          </div>
        </div>

        <button type="button" @click="f.items.push(row())" class="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-2xs">
          <i class="fa-solid fa-plus text-[10px]"></i>
          <span>Tambah Baris</span>
        </button>
      </div>

      <!-- Info Cabang & Catatan Diskon Dinamis -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-200 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <p class="text-[11px] font-bold text-slate-500 uppercase">Catatan</p>
          <p class="text-xs text-slate-700 mt-0.5 font-medium">
            Bawa kembali form ini & lakukan booking H-2 untuk mendapatkan diskon jasa 
            <span class="font-bold text-blue-600">{{ isSerangBranch ? '10%' : '15%' }}</span>.
          </p>
          
          <!-- Informasi Rekening BCA Khusus Cabang Serang -->
          <div v-if="isSerangBranch" class="mt-2.5 pt-2 border-t border-slate-200 text-xs text-slate-700 space-y-0.5 font-semibold">
            <p class="text-slate-900 font-bold">Rekening BCA Cabang Serang:</p>
            <p>An. PT. Astra International Tbk</p>
            <p class="text-blue-600 font-bold">No Rekening: 093.302.2533</p>
          </div>
        </div>
        <div class="text-right w-full sm:w-auto">
          <p class="text-[11px] font-bold text-slate-500 uppercase">Total Keseluruhan</p>
          <p class="text-lg font-extrabold text-blue-600">{{ rp(total(f)) }}</p>
        </div>
      </div>

      <div class="flex items-center gap-3 pt-2">
        <button type="button" @click="save" :disabled="loading" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow-sm shadow-blue-200 flex items-center gap-2 disabled:opacity-50">
          <i v-if="loading" class="fa-solid fa-spinner animate-spin text-xs"></i>
          <i v-else class="fa-solid fa-floppy-disk text-xs"></i>
          <span>{{ loading ? 'Menyimpan...' : (initialData ? 'Perbarui Data' : 'Simpan Data') }}</span>
        </button>
        <button type="button" @click="reset" :disabled="loading" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs transition shadow-2xs">
          Reset Form
        </button>
      </div>
    </div>
  </div>
</template>
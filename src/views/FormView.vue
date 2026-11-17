<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue'
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
  telp: '', 
  polisi: '', 
  rencana: '', 
  items: [row()] 
})

const f = reactive(blank())
const advisorsList = ref([])
const message = ref({ text: '', type: '' })
const loading = ref(false)
const activeProfile = ref(null)

// Ambil seluruh objek active_profile dari localStorage
const loadActiveProfile = () => {
  try {
    const profile = JSON.parse(localStorage.getItem('active_profile'))
    activeProfile.value = profile || null
    return profile
  } catch {
    activeProfile.value = null
    return null
  }
}

const getActiveProfileId = () => {
  const profile = loadActiveProfile()
  return profile ? profile.id : null
}

// Cek apakah cabang yang aktif adalah Serang
const isCabangSerang = computed(() => {
  if (!activeProfile.value) return false
  
  const email = (activeProfile.value.email || '').toLowerCase()
  const nama = (activeProfile.value.nama || '').toLowerCase()
  const kota = (activeProfile.value.kota || '').toLowerCase()
  const username = (activeProfile.value.username || '').toLowerCase()
  
  return (
    email.includes('irserang') ||
    email.includes('serang') ||
    nama.includes('serang') ||
    kota.includes('serang') ||
    username.includes('serang')
  )
})

// Konfigurasi dinamis berdasarkan cabang
const branchConfig = computed(() => {
  if (isCabangSerang.value) {
    return {
      diskon: '10%',
      noRekening: '093.3022533'
    }
  }
  return {
    diskon: '15%',
    noRekening: null
  }
})

// Helper konversi input desimal (mengubah koma menjadi titik agar aman dihitung)
const parseDecimal = (val) => {
  if (val === '' || val === null || val === undefined) return 0
  const normalized = String(val).replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

// Filter agar input Qty hanya menerima angka dan 1 tanda titik/koma desimal
const handleQtyInput = (item, event) => {
  let val = event.target.value.replace(',', '.')
  // Hapus karakter selain angka dan titik
  val = val.replace(/[^0-9.]/g, '')
  // Pastikan hanya ada 1 tanda titik desimal
  const parts = val.split('.')
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('')
  }
  item.qty = val
}

// Hitung total keseluruhan dengan dukungan Qty desimal
const grandTotal = computed(() => {
  return f.items.reduce((sum, it) => {
    return sum + (parseDecimal(it.qty) * parseDecimal(it.harga))
  }, 0)
})

onMounted(async () => {
  const profileId = getActiveProfileId()
  if (profileId) {
    const { data } = await fetchAdvisorsByProfile(profileId)
    advisorsList.value = data
  }
})

watch(() => props.initialData, (val) => {
  if (val) {
    f.id = val.id
    f.tanggal = val.tanggal
    f.nama = val.nama
    f.advisor = val.advisor
    f.namaMekanik = val.namaMekanik || ''
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

  // 1. Validasi Mandatory untuk seluruh field Header
  if (
    !f.tanggal ||
    !f.nama.trim() ||
    !f.advisor.trim() ||
    !f.namaMekanik.trim() ||
    !f.telp.trim() ||
    !f.polisi.trim() ||
    !f.rencana.trim()
  ) {
    message.value = { 
      text: 'Semua kolom wajib diisi (Tanggal Pemeriksaan, Nama Customer, Service Advisor, Mekanik, Nomor Telepon, Nomor Polisi, dan Rencana Penggantian).', 
      type: 'error' 
    }
    return
  }

  // 2. Validasi Mandatory untuk Daftar Jasa & Sparepart (Mendukung Qty Desimal > 0)
  const hasEmptyItem = f.items.some(
    (i) => !i.jasa.trim() || parseDecimal(i.qty) <= 0 || parseDecimal(i.harga) <= 0
  )

  if (!f.items.length || hasEmptyItem) {
    message.value = { 
      text: 'Semua baris Jasa/Sparepart wajib diisi lengkap (Nama Jasa/Sparepart, Qty lebih dari 0, dan Harga Satuan lebih dari 0).', 
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

  // Normalisasi angka desimal sebelum dikirim ke database
  const normalizedItems = f.items.map(i => ({
    ...i,
    qty: parseDecimal(i.qty),
    harga: parseDecimal(i.harga)
  }))

  const recordPayload = { ...f, items: normalizedItems }
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
      <p class="text-xs text-slate-500 mt-0.5">
        Lengkapi seluruh data header dan daftar jasa/sparepart (<span class="text-rose-600 font-bold">*</span> wajib diisi).
      </p>
    </div>

    <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 md:p-8 space-y-6">
      
      <div v-if="message.text" :class="message.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'" class="p-3.5 border rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-2xs transition-all">
        <i :class="message.type === 'error' ? 'fa-solid fa-circle-exclamation text-rose-600' : 'fa-solid fa-circle-check text-emerald-600'"></i>
        <span>{{ message.text }}</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Tanggal Pemeriksaan <span class="text-rose-600">*</span></label>
          <input type="date" v-model="f.tanggal" required class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nama Customer <span class="text-rose-600">*</span></label>
          <input v-model="f.nama" required placeholder="Nama customer" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Service Advisor <span class="text-rose-600">*</span></label>
          <select v-model="f.advisor" required class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs">
            <option value="" disabled>-- Pilih Service Advisor --</option>
            <option v-for="(adv, idx) in advisorsList" :key="idx" :value="adv.nama">
              {{ adv.nama }}
            </option>
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Mekanik <span class="text-rose-600">*</span></label>
          <input v-model="f.namaMekanik" required placeholder="Nama mekanik yang menangani" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nomor Telepon <span class="text-rose-600">*</span></label>
          <input type="tel" v-model="f.telp" required placeholder="08xxxxxxxxxx" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Nomor Polisi <span class="text-rose-600">*</span></label>
          <input v-model="f.polisi" required placeholder="B 1234 XYZ" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 uppercase placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Rencana Penggantian <span class="text-rose-600">*</span></label>
          <input v-model="f.rencana" required placeholder="Mis. 20 Nov 2026 / 5.000 km" class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs" />
        </div>
      </div>

      <div class="space-y-3 pt-4 border-t border-slate-200">
        <h3 class="font-bold text-xs text-slate-900 uppercase tracking-wide">Daftar Jasa & Sparepart <span class="text-rose-600">*</span></h3>

        <div class="space-y-2.5">
          <div v-for="(it, i) in f.items" :key="it.k" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 hidden sm:flex">{{ i + 1 }}</span>
            <input v-model="it.jasa" required placeholder="Nama Jasa / Sparepart *" class="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs" />
            <div class="flex items-center gap-2">
              <!-- Input Qty mendukung angka bulat maupun desimal (misal: 0.5, 1.5, 3.5) -->
              <input 
                type="text" 
                inputmode="decimal" 
                :value="it.qty" 
                @input="handleQtyInput(it, $event)" 
                required 
                placeholder="Qty *" 
                class="w-20 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 text-center focus:outline-none focus:border-blue-600 shadow-2xs" 
              />
              <input 
                type="number" 
                min="1" 
                step="any" 
                v-model.number="it.harga" 
                required 
                placeholder="Harga Satuan *" 
                class="w-28 sm:w-32 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 text-right focus:outline-none focus:border-blue-600 shadow-2xs" 
              />
            </div>
            <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
              <span class="font-extrabold text-xs text-slate-900 w-28 text-right">{{ rp(parseDecimal(it.qty) * parseDecimal(it.harga)) }}</span>
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

      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-200 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div class="space-y-1">
          <p class="text-[11px] font-bold text-slate-500 uppercase">Catatan</p>
          <p class="text-xs text-slate-700 font-medium">
            Bawa kembali form ini & lakukan booking H-2 untuk mendapatkan diskon jasa {{ branchConfig.diskon }}.
          </p>
          <p v-if="branchConfig.noRekening" class="text-xs text-slate-700 font-semibold">
            No. Rekening BCA: <span class="text-blue-700 font-bold">{{ branchConfig.noRekening }}</span>
          </p>
        </div>
        <div class="text-right w-full sm:w-auto">
          <p class="text-[11px] font-bold text-slate-500 uppercase">Total Keseluruhan</p>
          <p class="text-lg font-extrabold text-blue-600">{{ rp(grandTotal) }}</p>
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
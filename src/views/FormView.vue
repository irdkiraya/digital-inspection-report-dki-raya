<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { rp } from '../utils'
import { fetchAdvisorsByProfile, saveInspectionRecord, uploadInspectionPhoto } from '../services/inspectionsServicesSupabase'

const props = defineProps({ initialData: Object })
const emit = defineEmits(['save'])

const MAX_ITEMS = 30
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
const photoList = ref([])

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

const branchConfig = computed(() => {
  if (isCabangSerang.value) {
    return {
      diskon: '10%',
      noRekening: '093.3022533'
    }
  }
  return {
    diskon: '10%',
    noRekening: null
  }
})

const parseSavedPhotos = (fotoUrlField) => {
  if (!fotoUrlField) return []
  try {
    const parsed = JSON.parse(fotoUrlField)
    if (Array.isArray(parsed)) return parsed.filter(Boolean)
  } catch {
    // Fallback string URL tunggal
  }
  return typeof fotoUrlField === 'string' && fotoUrlField.trim() !== '' ? [fotoUrlField.trim()] : []
}

const parseDecimal = (val) => {
  if (val === '' || val === null || val === undefined) return 0
  const normalized = String(val).replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : num
}

const handleQtyInput = (item, event) => {
  let val = event.target.value.replace(',', '.')
  val = val.replace(/[^0-9.]/g, '')
  const parts = val.split('.')
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('')
  }
  item.qty = val
}

const grandTotal = computed(() => {
  return f.items.reduce((sum, it) => {
    return sum + (parseDecimal(it.qty) * parseDecimal(it.harga))
  }, 0)
})

const compressImageFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_SIZE = 1024
        let width = img.width
        let height = img.height

        if (width > height && width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width)
          width = MAX_SIZE
        } else if (height >= width && height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height)
          height = MAX_SIZE
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob((blob) => {
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
            type: 'image/jpeg'
          })
          resolve({
            id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
            url: URL.createObjectURL(blob),
            file: compressedFile
          })
        }, 'image/jpeg', 0.78)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function handleMultiplePhotos(event) {
  const files = Array.from(event.target.files || [])
  if (!files.length) return

  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    try {
      const photoObj = await compressImageFile(file)
      photoList.value.push(photoObj)
    } catch (err) {
      console.error('Gagal memproses foto:', err)
    }
  }
  event.target.value = ''
}

function removePhotoAt(index) {
  photoList.value.splice(index, 1)
}

function addItemRow() {
  if (f.items.length >= MAX_ITEMS) {
    message.value = { text: `Maksimal daftar jasa & sparepart adalah ${MAX_ITEMS} baris.`, type: 'error' }
    return
  }
  f.items.push(row())
}

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
    f.items = val.items && val.items.length
      ? val.items.slice(0, MAX_ITEMS).map(i => row(i.jasa, i.qty, i.harga))
      : [row()]

    const existingUrls = parseSavedPhotos(val.foto_url)
    photoList.value = existingUrls.map((url, idx) => ({
      id: `existing-${idx}`,
      url,
      file: null
    }))
  } else {
    Object.assign(f, blank())
    photoList.value = []
  }
}, { immediate: true })

const reset = () => { 
  Object.assign(f, blank())
  photoList.value = []
  message.value = { text: '', type: '' }
}

async function save() {
  message.value = { text: '', type: '' }

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

  if (f.items.length > MAX_ITEMS) {
    message.value = { text: `Maksimal jumlah baris jasa/sparepart adalah ${MAX_ITEMS}.`, type: 'error' }
    return
  }

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

  const finalPhotoUrls = []
  if (isCabangSerang.value && photoList.value.length > 0) {
    for (const itemPhoto of photoList.value) {
      if (itemPhoto.file) {
        const uploadRes = await uploadInspectionPhoto(itemPhoto.file, profileId)
        if (uploadRes.error) {
          loading.value = false
          message.value = { text: 'Gagal mengunggah salah satu foto: ' + uploadRes.error, type: 'error' }
          return
        }
        finalPhotoUrls.push(uploadRes.url)
      } else if (itemPhoto.url) {
        finalPhotoUrls.push(itemPhoto.url)
      }
    }
  }

  const normalizedItems = f.items.slice(0, MAX_ITEMS).map(i => ({
    ...i,
    qty: parseDecimal(i.qty),
    harga: parseDecimal(i.harga)
  }))

  const recordPayload = {
    ...f,
    photos: finalPhotoUrls,
    foto_url: finalPhotoUrls.length ? JSON.stringify(finalPhotoUrls) : null,
    items: normalizedItems
  }

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

        <div v-if="isCabangSerang" class="space-y-1.5 sm:col-span-2">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
            Lampiran Foto Kerusakan (Opsional — Bisa Lebih dari 1 Foto)
          </label>
          <div class="flex flex-wrap items-center gap-2.5">
            <label class="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs cursor-pointer transition shadow-2xs">
              <i class="fa-solid fa-camera"></i>
              <span>Ambil Foto (Kamera)</span>
              <input type="file" accept="image/*" capture="environment" @change="handleMultiplePhotos" class="hidden" />
            </label>

            <label class="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-2xl font-bold text-xs cursor-pointer transition shadow-2xs">
              <i class="fa-solid fa-images text-blue-600"></i>
              <span>Pilih dari Galeri</span>
              <input type="file" accept="image/*" multiple @change="handleMultiplePhotos" class="hidden" />
            </label>

            <span v-if="photoList.length" class="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200">
              {{ photoList.length }} Foto Terlampir
            </span>
          </div>
        </div>
      </div>

      <div v-if="isCabangSerang && photoList.length" class="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
        <p class="text-xs font-extrabold text-slate-800 uppercase tracking-wide text-center">
          PREVIEW FOTO KERUSAKAN (CETAK 10×10 CM KIRI & KANAN)
        </p>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div v-for="(photo, idx) in photoList" :key="photo.id" class="relative bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs">
            <img :src="photo.url" :alt="`Foto ${idx + 1}`" class="w-full h-32 object-cover rounded-xl border border-slate-200" />
            <span class="mt-1.5 block text-[10px] font-bold text-slate-600 text-center">
              Foto {{ idx + 1 }} ({{ idx % 2 === 0 ? 'Sisi Kiri' : 'Sisi Kanan' }})
            </span>
            <button 
              type="button" 
              @click="removePhotoAt(idx)" 
              class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs flex items-center justify-center shadow"
              title="Hapus Foto"
            >
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="space-y-3 pt-4 border-t border-slate-200">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xs text-slate-900 uppercase tracking-wide">
            Daftar Jasa & Sparepart <span class="text-rose-600">*</span>
          </h3>
          <span class="text-[11px] font-bold text-slate-500">
            {{ f.items.length }} / {{ MAX_ITEMS }} baris
          </span>
        </div>

        <div class="space-y-2.5">
          <div v-for="(it, i) in f.items" :key="it.k" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span class="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 hidden sm:flex">{{ i + 1 }}</span>
            <input v-model="it.jasa" required placeholder="Nama Jasa / Sparepart *" class="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs" />
            <div class="flex items-center gap-2">
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

        <button 
          type="button" 
          @click="addItemRow" 
          :disabled="f.items.length >= MAX_ITEMS"
          class="px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl font-bold text-xs transition flex items-center gap-2 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <i class="fa-solid fa-plus text-[10px]"></i>
          <span>{{ f.items.length >= MAX_ITEMS ? 'Batas Maksimal 30 Baris Tercapai' : 'Tambah Baris' }}</span>
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

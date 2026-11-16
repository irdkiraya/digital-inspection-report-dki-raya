<script setup>
import { ref, onMounted } from 'vue'
import ListView from './views/ListView.vue'
import FormView from './views/FormView.vue'
import LoginView from './views/LoginView.vue'
import AttendanceViews from './views/AttendanceViews.vue'
import DetailModal from './components/DetailModal.vue'
import { deleteInspectionRecord } from './services/inspectionsServicesSupabase.js'
import { sampleData } from './data'

const currentProfile = ref(null)
const isLoading = ref(true)
const page = ref('list')
const rows = ref(structuredClone(sampleData))
const sel = ref(null)
const editItem = ref(null)
const toast = ref('')
const refreshKey = ref(0)

onMounted(() => {
  // Cek apakah ada sesi login tersimpan di localStorage
  const savedProfile = localStorage.getItem('active_profile')
  if (savedProfile) {
    currentProfile.value = JSON.parse(savedProfile)
  }

  // Simulasi durasi splash screen awal (1.5 detik)
  setTimeout(() => {
    isLoading.value = false
  }, 1500)
})

function handleLoginSuccess(profile) {
  currentProfile.value = profile
  flash('Login berhasil, selamat datang ' + profile.nama)
}

function handleLogout() {
  if (confirm('Keluar dari akun cabang ini?')) {
    localStorage.removeItem('active_profile')
    currentProfile.value = null
    page.value = 'list'
    flash('Berhasil keluar')
  }
}

function flash(m) {
  toast.value = m;
  setTimeout(() => (toast.value = ''), 2200)
}

function onSave(rec) {
  if (editItem.value) {
    const idx = rows.value.findIndex(r => r.id === editItem.value.id)
    if (idx !== -1) {
      rows.value[idx] = { ...editItem.value, ...rec }
    }
    editItem.value = null
    flash('Data berhasil diperbarui')
  } else {
    rows.value.unshift({ id: 'INS-' + String(rows.value.length + 1).padStart(4, '0'), ...rec })
    flash('Data berhasil disimpan')
  }
  page.value = 'list'
}

function onEdit(r) {
  editItem.value = r
  page.value = 'form'
}

async function onDelete(r) {
  if (confirm('Hapus data inspeksi atas nama ' + r.nama + ' (' + r.polisi + ')?')) {
    const profileId = JSON.parse(localStorage.getItem('active_profile'))?.id
    if (!profileId) return

    const res = await deleteInspectionRecord(r.id, profileId)
    if (res.success) {
      flash(res.message)
      refreshKey.value++
      // Jika ListView menggunakan state lokal rows, filter baris yang dihapus:
      rows.value = rows.value.filter((x) => x.id !== r.id)
      // Atau jika menggunakan reload data dari database, panggil ulang fungsi load data ListView.
    } else {
      alert('Gagal menghapus: ' + res.error)
    }
  }
}
</script>

<template>
  <div>
    <!-- SPLASH SCREEN UTAMA (Tampil paling awal sebelum login/aplikasi dimuat) -->
    <transition name="fade">
      <div v-if="isLoading" class="fixed inset-0 z-50 bg-gradient-to-br from-sky-700 via-sky-600 to-sky-500 flex flex-col items-center justify-center text-white px-4">
        <div class="text-center space-y-4 animate-pulse">
          <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl border border-white/30 flex items-center justify-center mx-auto shadow-xl">
            <i class="fa-solid fa-car-side text-2xl text-white"></i>
          </div>
          <div>
            <h1 class="text-2xl font-extrabold tracking-wider drop-shadow-sm">ASTRA DAIHATSU</h1>
            <p class="text-xs text-sky-100 font-medium mt-1">Inspection Report System</p>
          </div>
          <div class="pt-6 flex flex-col items-center gap-2">
            <div class="w-7 h-7 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span class="text-[11px] text-sky-100 font-medium tracking-wide">Memuat Sistem...</span>
          </div>
        </div>
      </div>
    </transition>

    <!-- KONTROL UTAMA DENGAN TRANSISI HALUS (FADE & SLIDE) -->
    <transition name="page-transition" mode="out-in">
      <!-- JIKA BELUM LOGIN: TAMPILKAN HALAMAN LOGIN -->
      <LoginView v-if="!currentProfile" @loginSuccess="handleLoginSuccess" key="login" />

      <!-- JIKA SUDAH LOGIN: TAMPILKAN APLIKASI UTAMA -->
      <div v-else key="app" class="app-layout bg-[#F3F6FC] min-h-screen md:h-screen flex flex-col md:flex-row p-3 md:p-4 gap-4 md:gap-6 overflow-x-hidden md:overflow-hidden font-['Poppins',sans-serif] pb-24 md:pb-4 relative">

        <!-- DESKTOP SIDEBAR -->
        <aside class="hidden md:flex w-72 bg-white rounded-3xl p-5 flex-col justify-between shadow-sm border border-slate-200/80 shrink-0">
          <div>
            <div class="mb-8 px-2">
              <h1 class="font-bold text-slate-900 text-base tracking-wide">ASTRA DAIHATSU</h1>
              <p class="text-xs text-slate-500 font-medium mt-0.5">{{ currentProfile.nama }} · {{ currentProfile.kota }}</p>
            </div>

            <nav class="space-y-2">
              <button
                class="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 text-left"
                :class="page === 'list' ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
                @click="page = 'list'; editItem = null">
                <i class="fa-solid fa-layer-group text-sm"></i>
                <span>Data Inspeksi</span>
              </button>

              <button
                class="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 text-left"
                :class="page === 'form' ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
                @click="page = 'form'; editItem = null">
                <i class="fa-solid fa-circle-plus text-sm"></i>
                <span>Input Form</span>
              </button>

              <button
                class="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-200 text-left"
                :class="page === 'attendance' ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
                @click="page = 'attendance'">
                <i class="fa-solid fa-clipboard-user text-sm"></i>
                <span>Kehadiran</span>
              </button>
            </nav>
          </div>

          <!-- INFO PROFIL & TOMBOL LOGOUT -->
          <div class="px-2 pt-4 border-t border-slate-200 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold text-xs shadow-2xs">
                {{ currentProfile.nama.charAt(0) }}
              </div>
              <div class="overflow-hidden">
                <p class="text-[11px] font-bold text-slate-800 truncate">{{ currentProfile.nama }}</p>
                <p class="text-[10px] text-slate-500 truncate">{{ currentProfile.email }}</p>
              </div>
            </div>
            <button @click="handleLogout" class="text-slate-400 hover:text-rose-600 transition p-2" title="Keluar Akun">
              <i class="fa-solid fa-right-from-bracket text-xs"></i>
            </button>
          </div>
        </aside>

        <!-- MAIN CONTENT -->
        <main class="flex-1 bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-200/95 flex flex-col min-w-0">
          <header class="bg-gradient-to-r from-sky-700 via-sky-650 to-sky-600 px-6 md:px-8 py-6 text-white shrink-0 shadow-sm relative overflow-hidden">
            <div class="relative z-10 flex items-center justify-between">
              <div>
                <h1 class="text-lg md:text-xl font-bold tracking-wide drop-shadow-sm">ASTRA DAIHATSU</h1>
                <p class="text-[11px] md:text-xs text-sky-100 font-medium mt-0.5">{{ currentProfile.nama }} · {{ currentProfile.kota }}</p>
              </div>
              <!-- Tombol Logout Mobile di Header -->
              <button @click="handleLogout" class="md:hidden bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 backdrop-blur-sm">
                <i class="fa-solid fa-right-from-bracket"></i> Keluar
              </button>
            </div>
            <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
          </header>

          <div class="flex-1 overflow-y-auto">
            <ListView v-if="page === 'list'" :key="refreshKey" :rows="rows" @detail="sel = $event" @edit="onEdit" @remove="onDelete" />
            <FormView v-else-if="page === 'form'" :initialData="editItem" @save="onSave" />
            <AttendanceViews v-else-if="page === 'attendance'" @detail="sel = $event" />
          </div>
        </main>

        <!-- MOBILE BOTTOM NAVIGATION -->
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-6 py-2.5 flex items-center justify-around z-40 shadow-lg">
          <button @click="page = 'list'; editItem = null" class="flex flex-col items-center gap-1 transition-all"
            :class="page === 'list' ? 'text-blue-600 font-extrabold' : 'text-slate-400 font-semibold'">
            <i class="fa-solid fa-layer-group text-base"></i>
            <span class="text-[10px]">Data Inspeksi</span>
          </button>

          <button @click="page = 'form'; editItem = null" class="flex flex-col items-center gap-1 transition-all"
            :class="page === 'form' ? 'text-blue-600 font-extrabold' : 'text-slate-400 font-semibold'">
            <i class="fa-solid fa-circle-plus text-base"></i>
            <span class="text-[10px]">Input Form</span>
          </button>

          <button @click="page = 'attendance'; editItem = null" class="flex flex-col items-center gap-1 transition-all"
            :class="page === 'attendance' ? 'text-blue-600 font-extrabold' : 'text-slate-400 font-semibold'">
            <i class="fa-solid fa-clipboard-user text-sm"></i>
            <span class="text-[10px]">Kehadiran</span>
          </button>
        </nav>

        <DetailModal v-if="sel" :item="sel" @close="sel = null" />

        <div v-if="toast" class="fixed bottom-20 md:bottom-6 right-6 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 z-50 animate-bounce">
          <i class="fa-solid fa-circle-check text-emerald-400"></i>
          <span>{{ toast }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Transisi untuk Splash Screen */
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-leave-to {
  opacity: 0;
}

/* Transisi lembut (Soft Animation) saat berpindah dari halaman Login ke Aplikasi Utama */
.page-transition-enter-active,
.page-transition-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-transition-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-transition-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
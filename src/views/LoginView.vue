<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'

const emit = defineEmits(['loginSuccess'])

const email = ref('')
const password = ref('')
const loading = ref(false)
const errMsg = ref('')

async function handleLogin() {
  errMsg.value = ''
  if (!email.value || !password.value) {
    errMsg.value = 'Email dan password wajib diisi.'
    return
  }

  loading.value = true
  const cleanEmail = email.value.trim().toLowerCase()
  const cleanPassword = password.value.trim()

  try {
    // 1. Bypass/Hardcoded khusus untuk akun testing dengan ID TERISOLASI (Tidak sama dengan Serang)
    if (cleanEmail === 'irtestingdki@gmail.com' && cleanPassword === 'Testing123') {
      const { data: serangProfile } = await supabase
        .from('profile')
        .select('*')
        .ilike('nama', '%serang%')
        .limit(1)

      const baseProfile = serangProfile && serangProfile.length ? serangProfile[0] : {}

      const mockTestingProfile = {
        // PERBAIKAN UTAMA: Gunakan ID unik khusus testing agar data tidak tercampur dengan Serang
        id: 'ir-testing-profile-unique-id-999', 
        email: 'irtestingdki@gmail.com',
        nama: baseProfile.nama || 'PT. ASTRA DAIHATSU SERANG (TESTING)',
        alamat: baseProfile.alamat || 'Jl. Jend. Sudirman No.45, Panancangan, Cipocok Jaya, Kota Serang',
        kota: baseProfile.kota || 'Serang',
        telp: baseProfile.telp || '085173455151'
      }

      localStorage.setItem('active_profile', JSON.stringify(mockTestingProfile))
      emit('loginSuccess', mockTestingProfile)
      return
    }

    // 2. Query standar ke database Supabase untuk akun lainnya
    const { data, error } = await supabase
      .from('profile')
      .select('*')
      .eq('email', cleanEmail)
      .eq('password', cleanPassword)
      .limit(1)

    if (!error && data && data.length > 0) {
      const profile = data[0]
      localStorage.setItem('active_profile', JSON.stringify(profile))
      emit('loginSuccess', profile)
      return
    }

    errMsg.value = 'Email atau password salah.'
  } catch (err) {
    errMsg.value = 'Terjadi kesalahan sistem saat login.'
    console.error(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#F3F6FC] flex items-center justify-center p-4 font-['Poppins',sans-serif]">
    <div class="bg-white rounded-3xl border border-slate-200/90 shadow-xl w-full max-w-md p-8 space-y-6">
      
      <div class="text-center space-y-2">
        <div class="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-blue-200">
          <i class="fa-solid fa-car-side text-2xl text-white"></i>
        </div>
        <h1 class="text-xl font-extrabold text-slate-900 tracking-tight">ASTRA DAIHATSU</h1>
        <p class="text-xs text-slate-500 font-medium">Login Cabang · Inspection Report</p>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Email Cabang</label>
          <input 
            type="email" 
            v-model="email" 
            placeholder="contoh@daihatsu.co.id" 
            class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
          />
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Password</label>
          <input 
            type="password" 
            v-model="password" 
            placeholder="••••••••" 
            class="w-full bg-white border border-slate-300 rounded-2xl px-4 py-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition shadow-2xs"
          />
        </div>

        <div v-if="errMsg" class="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span>{{ errMsg }}</span>
        </div>

        <button 
          type="submit" 
          :disabled="loading"
          class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs transition shadow-md shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <i v-if="loading" class="fa-solid fa-spinner animate-spin"></i>
          <span>{{ loading ? 'Memproses...' : 'Masuk Aplikasi' }}</span>
        </button>
      </form>

      <div class="text-center pt-2 border-t border-slate-100">
        <p class="text-[10px] text-slate-400">Multi-tenant login support (Serang, Citra Raya, IR-Testing).</p>
      </div>

    </div>
  </div>
</template>
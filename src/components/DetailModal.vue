<script setup>
import { rp, fd, total, exportPdf } from '../utils'
import { fetchAdvisorsByProfile } from '../services/inspectionsServicesSupabase'

const props = defineProps({ item: Object })
defineEmits(['close'])

// Fungsi handle export PDF dinamis berdasarkan profil cabang
async function handleExportPdf() {
  let advisors = []
  try {
    const profile = JSON.parse(localStorage.getItem('active_profile'))
    if (profile && profile.id) {
      const res = await fetchAdvisorsByProfile(profile.id)
      advisors = res.data || []
    }
  } catch (err) {
    console.error('Gagal memuat data advisor untuk PDF:', err)
  }

  // Panggil exportPdf dengan menyertakan data item dan daftar advisor cabang
  exportPdf(props.item, advisors)
}
</script>

<template>
  <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" @click.self="$emit('close')">
    
    <!-- MODAL BOX CONTAINER -->
    <div class="bg-white rounded-3xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
      
      <!-- MODAL HEADER -->
      <div class="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-100/80">
        <div>
          <h2 class="text-base font-extrabold text-slate-900 tracking-tight">Detail Inspection Report</h2>
          <span class="text-xs text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200 inline-block mt-1 shadow-2xs">
            {{ item.id }}
          </span>
        </div>
        <button @click="$emit('close')" class="w-8 h-8 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition shadow-2xs">
          <i class="fa-solid fa-xmark text-xs"></i>
        </button>
      </div>

      <!-- MODAL BODY CONTENT -->
      <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
        
        <!-- GRID INFORMASI CUSTOMER & KENDARAAN -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div class="space-y-0.5">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Tanggal Pemeriksaan</p>
            <p class="text-xs font-semibold text-slate-800">{{ fd(item.tanggal) }}</p>
          </div>
          <div class="space-y-0.5">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nama Customer</p>
            <p class="text-xs font-bold text-slate-900">{{ item.nama }}</p>
          </div>
          <div class="space-y-0.5">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Service Advisor</p>
            <p class="text-xs font-semibold text-slate-800">{{ item.advisor || '-' }}</p>
          </div>
          <div class="space-y-0.5">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nama Mekanik</p>
            <p class="text-xs font-semibold text-slate-800">{{ item.namaMekanik || '-' }}</p>
          </div>
          <div class="space-y-0.5">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nomor Telepon</p>
            <p class="text-xs font-semibold text-slate-800">{{ item.telp || '-' }}</p>
          </div>
          <div class="space-y-0.5">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nomor Polisi</p>
            <p class="text-xs font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-300 inline-block shadow-2xs">
              {{ item.polisi }}
            </p>
          </div>
          <div class="space-y-0.5">
            <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Rencana Penggantian</p>
            <p class="text-xs font-semibold text-slate-800">{{ item.rencana || '-' }}</p>
          </div>
        </div>

        <!-- TABEL RINCIAN JASA & SPAREPART -->
        <div class="border border-slate-200 rounded-2xl overflow-x-auto shadow-2xs">
          <table class="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr class="bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                <th class="py-3 px-3.5">No</th>
                <th class="py-3 px-3.5">Jasa / Sparepart</th>
                <th class="py-3 px-3.5 text-center">Qty</th>
                <th class="py-3 px-3.5 text-right">Harga Satuan</th>
                <th class="py-3 px-3.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 text-xs">
              <tr v-for="(it, i) in item.items" :key="i" class="hover:bg-slate-50 transition">
                <td class="py-3 px-3.5 font-medium text-slate-500">{{ i + 1 }}</td>
                <td class="py-3 px-3.5 font-bold text-slate-900">{{ it.jasa }}</td>
                <td class="py-3 px-3.5 text-center font-semibold text-slate-700">{{ it.qty }}</td>
                <td class="py-3 px-3.5 text-right font-semibold text-slate-700">{{ rp(it.harga) }}</td>
                <td class="py-3 px-3.5 text-right font-extrabold text-slate-900">{{ rp((it.qty || 0) * (it.harga || 0)) }}</td>
              </tr>
              <!-- TOTAL ROW -->
              <tr class="bg-slate-100 font-bold border-t border-slate-200">
                <td colspan="4" class="py-3.5 px-3.5 text-right text-xs text-slate-800 uppercase tracking-wider">TOTAL KESELURUHAN</td>
                <td class="py-3.5 px-3.5 text-right text-xs text-blue-600 font-extrabold">{{ rp(total(item)) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- CATATAN / NOTE -->
        <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-900 text-xs font-medium shadow-2xs">
          <i class="fa-regular fa-lightbulb shrink-0 text-amber-600 text-sm"></i>
          <span>Bawa kembali form ini untuk mendapatkan diskon jasa 10%.</span>
        </div>

      </div>

      <!-- MODAL FOOTER ACTION -->
      <div class="px-6 py-4 border-t border-slate-200 bg-slate-100/80 flex items-center justify-between">
        <button @click="$emit('close')" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold text-xs transition shadow-2xs">
          Tutup
        </button>
        <!-- Tombol memanggil handleExportPdf agar daftar advisor cabang ikut dimuat ke PDF -->
        <button @click="handleExportPdf" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition shadow-sm shadow-blue-200 flex items-center gap-2">
          <i class="fa-solid fa-file-pdf text-xs"></i>
          <span>Export PDF</span>
        </button>
      </div>

    </div>
  </div>
</template>
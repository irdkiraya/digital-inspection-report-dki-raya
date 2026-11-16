<script setup>
import { ref, computed, onMounted } from 'vue'
import { rp, fd, total, exportExcel } from '../utils'
import { supabase } from '../supabase'

const emit = defineEmits(['detail', 'remove', 'edit'])

const rows = ref([])
const loading = ref(false)
const q = ref('')
const startDate = ref('')
const endDate = ref('')
const currentPage = ref(1)
const pageSize = 10
const totalRowsCount = ref(0)

// Ambil ID Cabang aktif dari localStorage
const getActiveProfileId = () => {
  try {
    const profile = JSON.parse(localStorage.getItem('active_profile'))
    return profile ? profile.id : null
  } catch {
    return null
  }
}

// Fungsi mengambil data dari database Supabase dengan Pagination & Filter Tanggal
async function loadData() {
  const profileId = getActiveProfileId()
  if (!profileId) return

  loading.value = true
  try {
    let query = supabase
      .from('inspeksi')
      .select(`
        id,
        tanggal,
        nama,
        namaMekanik,
        advisor,
        telp,
        polisi,
        rencana,
        items:inspection_items (
          jasa,
          qty,
          harga
        )
      `, { count: 'exact' })
      .eq('id_profile', profileId)
      .order('tanggal', { ascending: false })

    // Terapkan filter rentang tanggal jika diisi
    if (startDate.value) {
      query = query.gte('tanggal', startDate.value)
    }
    if (endDate.value) {
      query = query.lte('tanggal', endDate.value)
    }

    // Pagination (Range 10 data)
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize - 1
    query = query.range(start, end)

    const { data, count, error } = await query

    if (error) throw error
    rows.value = data || []
    totalRowsCount.value = count || 0
  } catch (err) {
    console.error('Gagal mengambil data inspeksi:', err.message)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

// Filter pencarian teks tambahan di sisi klien
const filtered = computed(() => {
  const s = q.value.toLowerCase().trim()
  return rows.value.filter((r) => !s || [r.nama, r.polisi, r.advisor, r.telp, r.id].join(' ').toLowerCase().includes(s))
})

const maxPage = computed(() => Math.ceil(totalRowsCount.value / pageSize) || 1)

function nextPage() {
  if (currentPage.value < maxPage.value) {
    currentPage.value++
    loadData()
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    loadData()
  }
}

function handleFilterChange() {
  currentPage.value = 1
  loadData()
}
</script>

<template>
  <div class="p-4 md:p-8 space-y-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-extrabold text-slate-800 tracking-tight">Data Inspeksi</h1>
        <p class="text-xs text-slate-500 mt-0.5">Kelola data inspeksi langsung dari database cabang.</p>
      </div>
      
      <!-- Tombol Export Excel -->
      <button 
        @click="exportExcel(rows)" 
        class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs transition shadow-sm flex items-center gap-2 self-start md:self-auto"
      >
        <i class="fa-solid fa-file-excel text-xs"></i>
        <span>Export Excel</span>
      </button>
    </div>

    <!-- FILTER & PENCARIAN -->
    <div class="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
      <div class="relative flex-1 w-full">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500 text-xs"></i>
        <input 
          type="text"
          v-model="q" 
          placeholder="Cari nama, nopol, advisor..." 
          class="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      <!-- Filter Rentang Tanggal -->
      <div class="flex items-center gap-2 w-full md:w-auto">
        <input 
          type="date" 
          v-model="startDate" 
          @change="handleFilterChange"
          class="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
        />
        <span class="text-xs text-slate-400">s/d</span>
        <input 
          type="date" 
          v-model="endDate" 
          @change="handleFilterChange"
          class="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
        />
      </div>

      <span class="bg-blue-50 text-blue-700 text-xs font-bold px-3.5 py-2 rounded-2xl shrink-0 border border-blue-200">
        Total: {{ totalRowsCount }} data
      </span>
    </div>

    <!-- LOADING STATE -->
    <div v-if="loading" class="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
      <i class="fa-solid fa-spinner animate-spin text-blue-600"></i> Memuat data dari database...
    </div>

    <!-- DESKTOP TABLE WRAPPER -->
    <div v-else class="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden hidden sm:block">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              <th class="py-3.5 px-5">Tanggal</th>
              <th class="py-3.5 px-5">Customer</th>
              <th class="py-3.5 px-5">No. Polisi</th>
              <th class="py-3.5 px-5">Advisor</th>
              <th class="py-3.5 px-5 text-right">Total</th>
              <th class="py-3.5 px-5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs">
            <tr 
              v-for="r in filtered" 
              :key="r.id" 
              @click="$emit('detail', r)"
              class="hover:bg-sky-50/60 transition-colors cursor-pointer group"
            >
              <td class="py-4 px-5 font-semibold text-slate-700 whitespace-nowrap">{{ fd(r.tanggal) }}</td>
              <td class="py-4 px-5">
                <p class="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{{ r.nama }}</p>
                <p class="text-[10px] text-slate-500 mt-0.5">{{ r.telp }}</p>
              </td>
              <td class="py-4 px-5">
                <span class="bg-slate-100 text-slate-800 font-extrabold px-3 py-1 rounded-xl text-[11px] border border-slate-300 shadow-2xs inline-block">
                  {{ r.polisi }}
                </span>
              </td>
              <td class="py-4 px-5 text-slate-700 font-semibold">{{ r.advisor }}</td>
              <td class="py-4 px-5 text-right font-extrabold text-blue-600">{{ rp(total(r)) }}</td>
              <td class="py-4 px-5 text-center whitespace-nowrap" @click.stop>
                <div class="flex items-center justify-center gap-1.5">
                  <button 
                    @click="$emit('edit', r)" 
                    class="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 flex items-center justify-center transition shadow-2xs" 
                    title="Edit Data"
                  >
                    <i class="fa-solid fa-pen-to-square text-xs"></i>
                  </button>
                  <button 
                    @click="$emit('remove', r)" 
                    class="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 flex items-center justify-center transition shadow-2xs" 
                    title="Hapus Data"
                  >
                    <i class="fa-solid fa-trash-can text-xs"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="6" class="text-center py-10 text-slate-400 text-xs">
                Data tidak ditemukan.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MOBILE CARDS VIEW -->
    <div v-if="!loading" class="sm:hidden space-y-4">
      <div 
        v-for="r in filtered" 
        :key="r.id" 
        @click="$emit('detail', r)"
        class="bg-white p-4 rounded-2xl border-2 border-slate-200/90 shadow-sm space-y-3 active:scale-[0.99] transition cursor-pointer"
      >
        <div class="flex items-center justify-between">
          <div>
            <span class="font-bold text-slate-900 text-sm block">{{ r.nama }}</span>
            <span class="text-[11px] text-slate-500 font-medium">{{ r.telp || '-' }}</span>
          </div>
          <span class="bg-slate-100 text-slate-900 font-extrabold px-3 py-1 rounded-xl text-[11px] border border-slate-300 shadow-2xs">
            {{ r.polisi }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 text-[11px] text-slate-600">
          <div>
            <span class="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Tanggal</span>
            <span class="font-semibold text-slate-800">{{ fd(r.tanggal) }}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Advisor</span>
            <span class="font-semibold text-slate-800">{{ r.advisor || '-' }}</span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2.5 border-t border-slate-100" @click.stop>
          <div>
            <span class="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Total Biaya</span>
            <span class="font-extrabold text-blue-600 text-sm">{{ rp(total(r)) }}</span>
          </div>
          <div class="flex gap-2">
            <button @click="$emit('edit', r)" class="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center shadow-xs">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
            </button>
            <button @click="$emit('remove', r)" class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shadow-xs">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- PAGINATION CONTROLS -->
    <div class="flex items-center justify-between pt-2">
      <button 
        @click="prevPage" 
        :disabled="currentPage === 1" 
        class="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 transition shadow-2xs"
      >
        <i class="fa-solid fa-chevron-left mr-1"></i> Sebelumnya
      </button>
      <span class="text-xs font-semibold text-slate-600">
         {{ currentPage }} dari {{ maxPage }}
      </span>
      <button 
        @click="nextPage" 
        :disabled="currentPage >= maxPage" 
        class="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 transition shadow-2xs"
      >
        Berikutnya <i class="fa-solid fa-chevron-right ml-1"></i>
      </button>
    </div>

  </div>
</template>
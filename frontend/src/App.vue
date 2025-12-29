<script setup>
import { ref, onMounted, computed } from 'vue'
import { generateKey, encrypt, decrypt, exportKey, importKey } from './utils/crypto'

// State
const mode = ref('create') // 'create', 'created', 'read', 'revealed', 'error'
const secretText = ref('')
const generatedUrl = ref('') // The full burn URL
const isLoading = ref(false)
const errorMsg = ref('')

// Read Mode State
const secretId = ref('')
const secretKeyStr = ref('')
const decryptedSecret = ref('')

// Initialize based on URL
onMounted(() => {
  checkUrl()
  window.addEventListener('hashchange', checkUrl)
})

function checkUrl() {
  const hash = window.location.hash
  // Expected format: #/secret/<id>#<key_jwk_base64>
  // Browser might interpret the second # as part of the hash or not?
  // Usually hash is unique.
  // Let's use a simpler format: /#/secret/<id>/<key>
  // Or: /#/secret/<id>?key=<key>
  // Or standard: fragment after route.
  // If we use Vue Router, it handles hash routing.
  // Manually:
  // window.location.hash might be "#/secret/123...#key..."
  
  if (hash.startsWith('#/secret/')) {
    mode.value = 'read'
    const parts = hash.split('/')
    // #, secret, <id_with_key_maybe>
    // If format is #/secret/<id>#<key>
    // parts[2] is "<id>#<key>"
    
    // Let's parse carefully
    const afterSecret = hash.substring('#/secret/'.length)
    // We expect "ID#KEY"
    // ID is usually UUID (36 chars)
    
    const keySeparatorIndex = afterSecret.indexOf('#')
    if (keySeparatorIndex !== -1) {
        secretId.value = afterSecret.substring(0, keySeparatorIndex)
        secretKeyStr.value = afterSecret.substring(keySeparatorIndex + 1)
    } else {
        // Fallback or error format
        errorMsg.value = "Invalid link format"
        mode.value = 'error'
    }
  } else {
    mode.value = 'create'
  }
}

// Actions
async function createLink() {
  if (!secretText.value) return
  isLoading.value = true
  errorMsg.value = ''
  
  try {
    // 1. Generate Key
    const key = await generateKey()
    
    // 2. Encrypt
    const { ciphertext, iv } = await encrypt(secretText.value, key)
    
    // 3. Send to Server (Backend)
    // Note: In dev, backend is on port 8787 (default) usually.
    // We need to know the backend URL.
    // Assuming relative path /api if proxied, or fully qualified if CORS.
    // Let's assume localhost:8787 for now, or configured via env?
    // User didn't specify production URL yet.
    // For local dev, Vite is 5173, Worker is 8787.
    // We'll try http://localhost:8787/api/secrets
    
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787'
    
    const response = await fetch(`${backendUrl}/api/secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ciphertext, iv })
    })
    
    if (!response.ok) throw new Error('Failed to save secret message')
    
    const data = await response.json()
    const id = data.id
    
    // 4. Generate Link
    const keyStr = await exportKey(key)
    const baseUrl = window.location.origin
    generatedUrl.value = `${baseUrl}/#/secret/${id}#${keyStr}`
    
    mode.value = 'created'
  } catch (e) {
    errorMsg.value = e.message
  } finally {
    isLoading.value = false
  }
}

async function revealSecret() {
  isLoading.value = true
  errorMsg.value = ''
  
  try {
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787'
    
    // 1. Fetch Ciphertext
    const response = await fetch(`${backendUrl}/api/secrets/${secretId.value}`)
    
    if (response.status === 404) {
      throw new Error('Secret message not found or already burned.')
    }
    if (!response.ok) throw new Error('Failed to retrieve secret message')
    
    const data = await response.json()
    
    // 2. Import Key
    const key = await importKey(secretKeyStr.value)
    
    // 3. Decrypt
    decryptedSecret.value = await decrypt(data.ciphertext, data.iv, key)
    
    mode.value = 'revealed'
  } catch (e) {
    errorMsg.value = e.message
    mode.value = 'error'
  } finally {
    isLoading.value = false
  }
}

function reset() {
  secretText.value = ''
  generatedUrl.value = ''
  mode.value = 'create'
  window.location.hash = ''
}

function copyLink() {
    navigator.clipboard.writeText(generatedUrl.value)
    // Maybe show toast
}
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-orange-500 selection:text-white">
    
    <!-- Header -->
    <header class="mb-12 text-center">
        <h1 class="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 tracking-tight mb-2">
            Burn After Reading
        </h1>
        <p class="text-slate-400 text-lg">Encrypt. Share. Burn.</p>
    </header>

    <!-- Main Card -->
    <div class="w-full max-w-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-8 sm:p-12 transition-all duration-500">
        
        <!-- Loading State -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
            <p class="text-slate-400">Processing...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="mode === 'error'" class="text-center">
            <div class="text-red-400 text-6xl mb-4">⚠️</div>
            <h2 class="text-2xl font-bold mb-2">Error</h2>
            <p class="text-slate-400 mb-6">{{ errorMsg }}</p>
            <button @click="reset" class="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white font-medium transition-colors">
                Go Home
            </button>
        </div>

        <!-- CREATE MODE -->
        <div v-else-if="mode === 'create'">
            <label class="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Secret Message</label>
            <textarea 
                v-model="secretText" 
                placeholder="Write your secret message here..." 
                class="w-full h-48 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none transition-all placeholder:text-slate-600 mb-6"
            ></textarea>
            
            <button 
                @click="createLink" 
                :disabled="!secretText"
                class="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
                🔥 Create Self-Destructing Link
            </button>
            <p class="mt-4 text-center text-slate-500 text-sm">
                Creating a link works entirely client-side. The key never leaves your browser.
            </p>
        </div>

        <!-- CREATED MODE -->
        <div v-else-if="mode === 'created'" class="text-center">
            <div class="text-5xl mb-4">🔒</div>
            <h2 class="text-2xl font-bold mb-6">Link Ready</h2>
            
            <div class="relative mb-8">
                <input 
                    readonly 
                    :value="generatedUrl" 
                    class="w-full bg-slate-950 border border-slate-800 rounded-xl py-4 pl-4 pr-32 text-slate-300 font-mono text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    @click="$event.target.select()"
                />
                <button 
                    @click="copyLink"
                    class="absolute right-2 top-2 bottom-2 bg-slate-800 hover:bg-slate-700 text-orange-400 px-4 rounded-lg font-medium transition-colors"
                >
                    Copy
                </button>
            </div>
            
            <button @click="reset" class="text-slate-500 hover:text-white transition-colors">
                Create Another
            </button>
            
            <div class="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-200/80 text-sm">
                Warning: This link can only be viewed once. Accessing it will destroy the message forever.
            </div>
        </div>

        <!-- READ MODE -->
        <div v-else-if="mode === 'read'" class="text-center">
             <div class="text-5xl mb-4">📬</div>
             <h2 class="text-2xl font-bold mb-4">You have a secret message</h2>
             <p class="text-slate-400 mb-8">
                 This message has been encrypted and stored securely. 
                 <br>Viewing it will permanently delete it from the server.
             </p>
             
             <button 
                @click="revealSecret" 
                class="w-full py-4 bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-400 hover:to-orange-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-red-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
                👀 Reveal Message
            </button>
        </div>

        <!-- REVEALED MODE -->
        <div v-else-if="mode === 'revealed'">
            <div class="flex justify-between items-center mb-4">
                <label class="block text-sm font-medium text-emerald-400 uppercase tracking-wider">Decrypted Message</label>
                <span class="text-xs text-slate-500">Message destroyed on server</span>
            </div>
            
            <div class="w-full min-h-[12rem] bg-slate-950 border border-slate-800 rounded-xl p-6 text-lg text-slate-200 font-mono breaking-words whitespace-pre-wrap mb-8">
                {{ decryptedSecret }}
            </div>
            
            <button 
                @click="reset"
                class="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-colors"
            >
                Create New Secret Message
            </button>
        </div>

    </div>
    
    <footer class="mt-12 text-slate-600 text-sm">
        <a href="#" class="hover:text-slate-400 transition-colors">Privacy</a> • 
        <a href="#" class="hover:text-slate-400 transition-colors">Terms</a>
    </footer>
  </div>
</template>

<style>
/* Custom Scrollbar if needed, standard Tailwind usually enough */
</style>

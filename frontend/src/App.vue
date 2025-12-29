<script setup>
import { ref, onMounted, computed } from 'vue'
import { generateKey, encrypt, decrypt, exportKey, importKey } from './utils/crypto'

import { parseSecretUrl } from './utils/urlParser'

// State
const mode = ref('create') // 'create', 'created', 'read', 'revealed', 'error'
const secretText = ref('')
const uploadType = ref('message') // 'message', 'file'
const selectedFile = ref(null)
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
  
  // Use our utility to safely parse
  try {
    const result = parseSecretUrl(hash)
    if (result) {
        mode.value = 'read'
        secretId.value = result.id
        secretKeyStr.value = result.key
    } else {
        mode.value = 'create'
    }
  } catch (e) {
      mode.value = 'error'
      errorMsg.value = e.message
  }
}

// Actions
function handleFileSelect(event) {
    const file = event.target.files[0]
    if (!file) {
        selectedFile.value = null
        return
    }
    
    // 10MB Limit
    if (file.size > 10 * 1024 * 1024) {
        errorMsg.value = "File size exceeds 10MB limit."
        event.target.value = '' // Reset input
        selectedFile.value = null
        return
    }
    
    selectedFile.value = file
    errorMsg.value = ''
}

async function createLink() {
  if (uploadType.value === 'message' && !secretText.value) return
  if (uploadType.value === 'file' && !selectedFile.value) return
  
  isLoading.value = true
  errorMsg.value = ''
  
  try {
    // 1. Generate Key
    const key = await generateKey()
    
    // 2. Encrypt
    let payload = {}
    
    if (uploadType.value === 'file') {
        // Read file to ArrayBuffer
        const buffer = await selectedFile.value.arrayBuffer()
        const { ciphertext, iv } = await encrypt(buffer, key, true) // returnBinary=true
        
        // Prepare FormData
        const formData = new FormData()
        formData.append('ciphertext', new Blob([ciphertext])) // Send as Blob
        formData.append('ciphertext', new Blob([ciphertext])) // Send as Blob 
        // Wait, backend expects 'iv' string for text? No, it just stores it.
        // But for file mode, we sent 'iv' string before in text mode.
        // Let's send IV as base64 string for consistency in KV? 
        // The backend `formData.get('iv')` will return string if we append string.
        // `encrypt` returns Uint8Array for iv. Let's convert to base64 string.
        
        // Helper to convert Uint8Array back to Base64 for transport/metadata
        const ivB64 = btoa(String.fromCharCode(...iv))
        formData.append('iv', ivB64)
        
        formData.append('filename', selectedFile.value.name)
        // expiry? default 3600
        
        payload = {
            body: formData,
            headers: {} // Content-Type auto-set with boundary
        }
    } else {
        const { ciphertext, iv } = await encrypt(secretText.value, key)
        payload = {
            body: JSON.stringify({ ciphertext, iv }),
            headers: { 'Content-Type': 'application/json' }
        }
    }
    
    // 3. Send to Server
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787'
    
    const response = await fetch(`${backendUrl}/api/secrets`, {
      method: 'POST',
      headers: payload.headers,
      body: payload.body
    })
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to save secret')
    }
    
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
    
    // 1. Fetch
    const response = await fetch(`${backendUrl}/api/secrets/${secretId.value}`)
    
    if (response.status === 404) {
      throw new Error('Secret not found or already burned.')
    }
    if (!response.ok) throw new Error('Failed to retrieve secret')
    
    const contentType = response.headers.get('Content-Type')
    const key = await importKey(secretKeyStr.value)

    if (contentType && contentType.includes('application/json')) {
        // Text Secret
        const data = await response.json()
        decryptedSecret.value = await decrypt(data.ciphertext, data.iv, key)
        mode.value = 'revealed' // Show in UI
    } else {
        // File Secret
        // Read headers for metadata
        const ivB64 = response.headers.get('X-Burn-IV')
        const filename = response.headers.get('X-Burn-Filename') || 'downloaded-file'
        
        if (!ivB64) throw new Error('Missing encryption metadata in response')
        
        // Read body as ArrayBuffer
        const encryptedBuffer = await response.arrayBuffer()
        
        // Decrypt
        // Note: decrypt expects iv as base64 string (default) or Buffer? 
        // My updated decrypt handles both if I pass returnBinary=true?
        // Wait, the `iv` arg in `decrypt` checks if string -> base64ToBuffer.
        // `ivB64` is base64 string. So passing it is fine.
        
        const decryptedBuffer = await decrypt(encryptedBuffer, ivB64, key, true)
        
        // Trigger Download
        const blob = new Blob([decryptedBuffer])
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        mode.value = 'revealed'
        decryptedSecret.value = `File "${filename}" downloaded successfully.`
    }
    
  } catch (e) {
    errorMsg.value = e.message
    mode.value = 'error'
  } finally {
    isLoading.value = false
  }
}

function reset() {
  secretText.value = ''
  selectedFile.value = null
  uploadType.value = 'message'
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
            <!-- Tabs -->
            <div class="flex space-x-4 mb-6 border-b border-slate-700 pb-2">
                <button 
                    @click="uploadType = 'message'"
                    :class="[
                        'pb-2 text-sm font-medium transition-colors uppercase tracking-wider outline-none',
                        uploadType === 'message' 
                            ? 'text-orange-500 border-b-2 border-orange-500' 
                            : 'text-slate-500 hover:text-slate-300'
                    ]"
                >
                    Message
                </button>
                <button 
                    @click="uploadType = 'file'"
                    :class="[
                         'pb-2 text-sm font-medium transition-colors uppercase tracking-wider outline-none',
                        uploadType === 'file' 
                            ? 'text-orange-500 border-b-2 border-orange-500' 
                            : 'text-slate-500 hover:text-slate-300'
                    ]"
                >
                    File
                </button>
            </div>

            <div v-if="uploadType === 'message'">
                <label class="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Secret Message</label>
                <textarea 
                    v-model="secretText" 
                    placeholder="Write your secret message here..." 
                    class="w-full h-48 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-lg text-slate-200 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none transition-all placeholder:text-slate-600 mb-6"
                ></textarea>
            </div>
            
            <div v-if="uploadType === 'file'">
                 <label class="block text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Secret File</label>
                 <div 
                    class="w-full h-48 bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center p-4 mb-6 hover:border-orange-500/50 transition-colors relative"
                 >
                    <input 
                        type="file" 
                        @change="handleFileSelect"
                        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div v-if="selectedFile" class="text-center">
                        <div class="text-4xl mb-2">📄</div>
                        <p class="text-slate-200 font-medium truncate max-w-xs">{{ selectedFile.name }}</p>
                        <p class="text-slate-500 text-sm">{{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB</p>
                    </div>
                    <div v-else class="text-center">
                         <div class="text-4xl mb-2 text-slate-600">📁</div>
                         <p class="text-slate-400">Click or Drag file here</p>
                         <p class="text-slate-600 text-xs mt-1">Max 10MB</p>
                    </div>
                 </div>
            </div>
            
            <div v-if="errorMsg" class="mb-4 text-red-400 text-sm text-center bg-red-900/20 p-2 rounded-lg border border-red-900/50">
                {{ errorMsg }}
            </div>
            
            <button 
                @click="createLink" 
                :disabled="(uploadType === 'message' && !secretText) || (uploadType === 'file' && !selectedFile)"
                class="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl shadow-lg shadow-orange-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
                🔥 Create Self-Destructing Link
            </button>
            <p class="mt-4 text-center text-slate-500 text-sm">
                Encryption happens entirely in your browser.
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
                <label class="block text-sm font-medium text-emerald-400 uppercase tracking-wider">
                    {{ decryptedSecret.includes('downloaded') ? 'Success' : 'Decrypted Message' }}
                </label>
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
      <div class="flex flex-col gap-2 items-center text-center">
        <p>Created by Matt Carabine for fun.</p>
        <p>Please don't store anything <i>actually</i> secret here.</p>
      </div>
    </footer>
  </div>
</template>

<style>
/* Custom Scrollbar if needed, standard Tailwind usually enough */
</style>

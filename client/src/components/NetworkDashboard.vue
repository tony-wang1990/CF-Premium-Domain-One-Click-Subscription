<template>
  <div class="network-dashboard dashboard-main-card">
    <div class="dashboard-header">
      <div class="section-title">
        <span class="icon">●</span> 网络环境检测
      </div>
      <div class="header-hint">（IP由服务器检测，延迟由您的浏览器测试）</div>
    </div>

    <div class="dashboard-body">
      <!-- Simplified IP Info - Just show key info -->
      <div class="ip-summary">
        <div class="ip-main">
          <span class="ip-label">您的公网IP：</span>
          <span class="ip-value-large">{{ ipInfos.domestic.ip || '检测中...' }}</span>
          <span class="ip-loc">{{ ipInfos.domestic.location }}</span>
        </div>
        <div class="ip-secondary">
          <span v-if="ipInfos.cloudflare.ip && ipInfos.cloudflare.ip !== 'Error'">
            CF节点: {{ ipInfos.cloudflare.location }}
          </span>
        </div>
      </div>

      <!-- Latency Grid - Core Feature -->
      <div class="latency-section-title">📶 网站连通性测试（从您的位置测试）</div>
      <div class="latency-grid">
        <div class="latency-card" v-for="site in sites" :key="site.name">
          <div class="site-row">
            <div class="site-info">
              <span class="site-icon">{{ site.icon }}</span>
              <span class="site-name">{{ site.name }}</span>
            </div>
            <div class="site-stat">
              <span class="latency-ms" :class="getLatencyClass(site.latency)">
                {{ site.latency === -1 ? '超时' : (site.latency ? site.latency + 'ms' : '测试中...') }}
              </span>
              <n-tag size="tiny" :type="site.type === '国内' ? 'success' : 'info'" bordered>
                {{ site.type }}
              </n-tag>
            </div>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" 
                 :style="{ width: getProgressWidth(site.latency), backgroundColor: getLatencyColor(site.latency) }">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NTag } from 'naive-ui'

interface IpInfo {
  title: string
  desc: string
  ip: string
  location: string
  url: string
}

interface Site {
  name: string
  icon: string
  type: '国内' | '国际'
  url: string
  latency: number
}

const ipInfos = ref<Record<string, IpInfo>>({
  domestic: {
    title: '国内测试 (Sohu)',
    desc: '通过搜狐API检测的公网IP',
    ip: '',
    location: '',
    url: ''
  },
  abroad: {
    title: '国外测试 (ipify)',
    desc: '通过ipify.org检测到的IP',
    ip: '',
    location: '',
    url: ''
  },
  cloudflare: {
    title: 'Cloudflare',
    desc: '访问CFCDN节点IP',
    ip: '',
    location: '',
    url: ''
  },
  leak: {
    title: '国外测试 (ifconfig)',
    desc: 'ifconfig.co检测到的IP',
    ip: '',
    location: '',
    url: ''
  },
  ipApi: {
    title: '国际查询 (IP-API)',
    desc: 'IP-API.com 提供的综合信息',
    ip: '',
    location: '',
    url: ''
  },
  aws: {
    title: 'AWS 检测',
    desc: 'Amazon AWS 看到的您的 IP',
    ip: '',
    location: '',
    url: ''
  }
})

const sites = ref<Site[]>([
  { name: '字节跳动', icon: '🎵', type: '国内', url: '', latency: 0 },
  { name: 'Bilibili', icon: '📺', type: '国内', url: '', latency: 0 },
  { name: '微信', icon: '💬', type: '国内', url: '', latency: 0 },
  { name: '淘宝', icon: '🛍️', type: '国内', url: '', latency: 0 },
  { name: 'GitHub', icon: '🐙', type: '国际', url: '', latency: 0 },
  { name: 'Google', icon: '🔍', type: '国际', url: '', latency: 0 },
  { name: 'Cloudflare', icon: '☁️', type: '国际', url: '', latency: 0 },
  { name: 'YouTube', icon: '▶️', type: '国际', url: '', latency: 0 },
])

const fetchNetworkStatus = async () => {
    try {
        // Use backend for IP detection (bypass CORS and GFW restrictions)
        const res = await fetch('/api/network-status')
        const data = await res.json()
        
        // Update IPs from backend
        if(data.ip) {
            if(data.ip.domestic) { 
                ipInfos.value.domestic.ip = data.ip.domestic.ip
                ipInfos.value.domestic.location = data.ip.domestic.location 
            }
            if(data.ip.abroad) { 
                ipInfos.value.abroad.ip = data.ip.abroad.ip
                ipInfos.value.abroad.location = data.ip.abroad.location 
            }
            if(data.ip.cloudflare) { 
                ipInfos.value.cloudflare.ip = data.ip.cloudflare.ip
                ipInfos.value.cloudflare.location = data.ip.cloudflare.location 
            }
            if(data.ip.leak) { 
                ipInfos.value.leak.ip = data.ip.leak.ip
                ipInfos.value.leak.location = data.ip.leak.location 
            }
            if(data.ip.ipApi) { 
                ipInfos.value.ipApi.ip = data.ip.ipApi.ip
                ipInfos.value.ipApi.location = data.ip.ipApi.location 
            }
            if(data.ip.aws) { 
                ipInfos.value.aws.ip = data.ip.aws.ip
                ipInfos.value.aws.location = data.ip.aws.location 
            }
        }

        // Client-side latency testing (measure real connection time from browser)
        const measureBrowserLatency = async (url: string) => {
            try {
                const start = performance.now()
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), 5000)
                
                await fetch(url, { 
                    method: 'HEAD', 
                    mode: 'no-cors',
                    cache: 'no-cache',
                    signal: controller.signal
                })
                
                clearTimeout(timeoutId)
                const end = performance.now()
                return Math.round(end - start)
            } catch (error) {
                return -1
            }
        }

        // Test latency to popular sites from the user's browser
        const latencyTests = sites.value.map(async (site) => {
            const url = site.url || `https://${site.name.toLowerCase()}.com`
            site.latency = await measureBrowserLatency(url)
        })

        await Promise.all(latencyTests)

    } catch(e) {
        console.error('Failed to fetch network status', e)
    }
}

const getLatencyClass = (ms: number) => {
  if (ms === -1) return 'text-gray'
  if (ms < 100) return 'text-green'
  if (ms < 300) return 'text-yellow'
  return 'text-red'
}

const getLatencyColor = (ms: number) => {
  if (ms === -1) return '#9ca3af'
  if (ms < 100) return '#4ade80'
  if (ms < 300) return '#facc15'
  return '#f87171'
}

const getProgressWidth = (ms: number) => {
  if (ms <= 0) return '0%'
  if (ms === -1) return '100%'
  // Scale: 0-1000ms -> 0-100%
  const p = Math.min(ms / 10, 100)
  return `${p}%`
}

onMounted(() => {
  fetchNetworkStatus()
})
</script>

<style scoped>
.network-dashboard {
  margin-bottom: 30px;
}

/* Big Card Container */
.dashboard-main-card {
  background: var(--bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.dashboard-header {
  padding: 15px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-card);
}

.dashboard-body {
  padding: 20px;
}

.section-title {
  font-size: 1rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
}

.section-title .icon {
  color: #10b981;
}

/* Header Hint */
.header-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

/* IP Summary - Simplified */
.ip-summary {
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 15px 20px;
  margin-bottom: 20px;
}

.ip-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ip-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.ip-value-large {
  font-size: 1.1rem;
  font-weight: bold;
  color: #f97316;
  font-family: monospace;
}

.ip-loc {
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding: 2px 8px;
  background: rgba(249, 115, 22, 0.1);
  border-radius: 4px;
}

.ip-secondary {
  margin-top: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Latency Section Title */
.latency-section-title {
  font-size: 0.95rem;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

/* IP Grid */
.ip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 20px;
  margin-bottom: 25px;
}

.ip-card {
  background: var(--bg-body); /* Subtle contrast */
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 15px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.ip-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-title {
  font-size: 0.85rem;
  color: #f97316; /* Orange title like reference */
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
}

.dot {
  color: #10b981;
  font-size: 0.6rem;
}

.ip-value {
  font-size: 1.1rem;
  font-weight: bold;
  margin-bottom: 4px;
  font-family: monospace;
  color: var(--text-primary);
}

.ip-location {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.ip-desc {
  font-size: 0.75rem;
  color: #9ca3af;
  margin-top: auto;
  border-top: 1px dashed var(--border-color);
  padding-top: 8px;
}

/* Latency Grid */
.latency-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 15px;
}

.latency-card {
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 15px;
}

.site-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.site-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.site-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.site-stat {
  display: flex;
  align-items: center;
  gap: 8px;
}

.latency-ms {
  font-weight: bold;
  font-size: 0.85rem;
  min-width: 40px;
  text-align: right;
}

.progress-bar-bg {
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.5s ease;
}

.text-green { color: #10b981; }
.text-yellow { color: #f59e0b; }
.text-red { color: #ef4444; }
.text-gray { color: #9ca3af; }
</style>

<template>
  <n-config-provider :theme="theme">
    <div class="app-container" :class="{ 'dark-mode': isDark, 'light-mode': !isDark }">
      <!-- 顶部导航/工具栏 -->
      <nav class="nav-bar glass-panel">
        <div class="logo">
          <span class="logo-icon">☁️</span>
          <span class="logo-text">CloudFlare 优选域名</span>
        </div>
        <div class="nav-actions">

           <n-button class="theme-toggle-btn" circle secondary @click="toggleTheme">
             <template #icon>
               <span v-if="isDark">🌙</span>
               <span v-else>☀️</span>
             </template>
           </n-button>
           <n-button class="refresh-btn-styled" @click="refreshDomains" :loading="refreshing">
             <template #icon>🔄</template>
             刷新数据
           </n-button>
        </div>
      </nav>

      <main class="main-content">
        <!-- 头部公告区域 -->
        <div class="hero-section">
           <h1>CloudFlare 优选域名</h1>
           <p class="subtitle">
             自动收集全网优质 CF IP/域名，实时更新。<br>
             包含官方优选、运营商(CM/CU/CT)优化线路及第三方大带宽节点。
           </p>
        </div>
        
        <div class="hero-actions">
          <n-button type="primary" class="pulsing-button" @click="showSubscribeModal = true">
            <template #icon>
              <span class="icon-flash">⚡</span>
            </template>
            一键生成优选订阅
          </n-button>
        </div>

        <!-- 🔥 醒目的全局测速提示 -->
        <div class="speed-test-banner" v-if="!hasTestedSpeed">
          <div class="banner-left">
            <span class="banner-icon">🚀</span>
            <div class="banner-text">
              <strong>第一步：点击测速</strong>
              <p>测试您的网络到各CF域名的延迟，找出最快的节点</p>
            </div>
          </div>
          <button class="big-test-btn" @click="pingAll" :disabled="isGlobalPinging">
            <span v-if="!isGlobalPinging">🚀 开始全局测速</span>
            <span v-else class="testing-status">
              ⏳ 测速中... {{ testedCount }}/{{ domains.length }}
            </span>
          </button>
        </div>
        <div class="speed-test-done" v-else>
          <span>✅ 已测速 {{ testedCount }} 个域名，点击"按延迟排序"查看最快节点</span>
          <button class="big-retest-btn" @click="pingAll" :disabled="isGlobalPinging">
            {{ isGlobalPinging ? '⏳ 测速中...' : '🔄 重新测速' }}
          </button>
        </div>

        <!-- Search & Filter Section -->
        <div class="filter-section glass-panel">
           <div class="search-box">
             <span class="search-icon">🔍</span>
             <input v-model="searchQuery" type="text" placeholder="搜索域名 / IP..." class="search-input">
           </div>
           <div class="filter-tags">
             <span class="filter-tag" :class="{ active: filterType === 'all' }" @click="filterType = 'all'">全部</span>
             <span class="filter-tag" :class="{ active: filterType === 'official' }" @click="filterType = 'official'">官方优选</span>
             <span class="filter-tag" :class="{ active: filterType === 'cm' }" @click="filterType = 'cm'">移动直连</span>
             <span class="filter-tag" :class="{ active: filterType === 'third-party' }" @click="filterType = 'third-party'">第三方</span>
           </div>
           <div class="sort-controls" style="margin-left: auto; display: flex; gap: 5px;">
             <n-button size="small" dashed :type="sortBy === 'default' ? 'info' : 'default'" @click="sortBy = 'default'">
                默认排序
             </n-button>
             <n-button size="small" dashed :type="sortBy === 'latency' ? 'success' : 'default'" @click="sortBy = 'latency'">
                📶 按延迟(低→高)
             </n-button>
           </div>
        </div>

        <NetworkDashboard />

        <!-- 官方优选 -->
        <section class="domain-section">
          <div class="section-badge official">🏛️ 推荐</div>
          <h2>官方优选域名</h2>
          <p class="section-desc">
            来自 Visa, Shopify, Gov 等官方网站的 CDN 域名，稳定性极高，适合长期使用。
            <br><span class="tip">⚠️ 注意：请务必保留域名的 www 前缀（如有）</span>
          </p>
          
          <div class="domain-list">
            <div v-for="item in officialDomains" :key="item.domain" class="monitor-card">
              <!-- Left: Info & Description -->
              <div class="monitor-left">
                <div class="monitor-header">
                  <div class="domain-btn-orange">
                    <span class="icon">{{ getRegionFlag(item.region) }}</span> {{ item.domain }}
                  </div>
                  <div class="tag-group">
                    <span class="tag-pill soft">泛域名</span>
                    <span class="tag-pill pink">🔥 三网优选</span>
                  </div>
                  <button class="btn-ghost" @click="copy(item.domain)">
                    &lt; &gt; TCPing
                  </button>
                  <button class="btn-ghost" @click="checkPing(item)" :class="{'pinging': item.isPinging}">
                    <span v-if="item.realPing" :class="getPingColor(item.realPing)">{{ item.realPing }}ms</span>
                    <span v-else>{{ item.isPinging ? '...' : '📶 测速' }}</span>
                  </button>
                </div>
                
                <div class="desc-box-yellow">
                  <div class="desc-title">💡 泛域名说明:</div>
                  <div class="desc-content">
                    以下域名的使用效果都是一样的：
                    <ul>
                      <li>youxuan.{{ item.domain }}</li>
                      <li>best.{{ item.domain }}</li>
                      <li>123.{{ item.domain }}</li>
                    </ul>
                    {{ item.description || '推荐优先使用自定义前缀的泛域名。' }}
                  </div>
                </div>
              </div>

              <!-- Right: 24小时三网测速 (全国参考数据) -->
              <div class="monitor-right">
                <div class="chart-header">
                  <span class="chart-title">📊 全国三网参考 <span class="data-source-note">(点击左侧测速获取您的真实延迟)</span></span>
                  <a :href="'https://www.itdog.cn/tcping/' + item.domain + ':443'" target="_blank" class="tcping-link">TCPing</a>
                </div>
                
                <!-- 电信 -->
                <div class="chart-row">
                  <span class="chart-label ct">电信</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'ct')" 
                         :key="'ct-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'ct').latency }}/{{ getIspAverage(item.domain, 'ct').lossRate }}</span>
                </div>

                <!-- 移动 -->
                <div class="chart-row">
                  <span class="chart-label cm">移动</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'cm')" 
                         :key="'cm-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'cm').latency }}/{{ getIspAverage(item.domain, 'cm').lossRate }}</span>
                </div>

                <!-- 联通 -->
                <div class="chart-row">
                  <span class="chart-label cu">联通</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'cu')" 
                         :key="'cu-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'cu').latency }}/{{ getIspAverage(item.domain, 'cu').lossRate }}</span>
                </div>

                <div class="chart-footer">
                     <div class="chart-legend">
                       <div class="legend-title">丢包率:</div>
                       <div class="legend-i"><span class="bit-sample green"></span> 0%</div>
                       <div class="legend-i"><span class="bit-sample yellow"></span> 0~10%</div>
                       <div class="legend-i"><span class="bit-sample red"></span> &gt;10%</div>
                       <div class="legend-i"><span class="bit-sample gray"></span> 失联</div>
                    </div>
                    <div class="chart-val-legend">平均延迟/丢包率</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- CM/移动优选 -->
        <section class="domain-section">
          <div class="section-badge cm">🌟 极速</div>
          <h2>CM / 移动优选域名</h2>
          <p class="section-desc">
            针对中国移动网络优化的线路，部分也适用于联通/电信。
          </p>
          
          <!-- CM Section Reuse similar structure -->
          <div class="domain-list">
            <div v-for="item in cmDomains" :key="item.domain" class="monitor-card">
              <!-- Left -->
              <div class="monitor-left">
                <div class="monitor-header">
                  <div class="domain-btn-orange">
                    <span class="icon">{{ getRegionFlag(item.region) }}</span> {{ item.domain }}
                  </div>
                  <div class="tag-group">
                    <span class="tag-pill soft">泛域名</span>
                    <span class="tag-pill pink">移动直连</span>
                  </div>
                   <button class="btn-ghost" @click="copy(item.domain)">
                    &lt; &gt; TCPing
                  </button>
                  <button class="btn-ghost" @click="checkPing(item)" :class="{'pinging': item.isPinging}">
                    <span v-if="item.realPing" :class="getPingColor(item.realPing)">{{ item.realPing }}ms</span>
                    <span v-else>{{ item.isPinging ? '...' : '📶 测速' }}</span>
                  </button>
                </div>
                
                <div class="desc-box-yellow">
                  <div class="desc-title">💡 线路说明:</div>
                  <div class="desc-content">
                     {{ item.description || '针对中国移动优化的线路，兼顾联通电信。' }}
                     <br>推荐配合优选 IP 使用。
                  </div>
                </div>
              </div>

              <!-- Right: 24小时三网测速 (真实历史数据) -->
              <div class="monitor-right">
                <div class="chart-header">
                  <span class="chart-title">📊 全国三网参考 <span class="data-source-note">(点击左侧测速获取您的真实延迟)</span></span>
                  <a :href="'https://www.itdog.cn/tcping/' + item.domain + ':443'" target="_blank" class="tcping-link">TCPing</a>
                </div>
                
                <!-- 电信 -->
                <div class="chart-row">
                  <span class="chart-label ct">电信</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'ct')" 
                         :key="'ct-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'ct').latency }}/{{ getIspAverage(item.domain, 'ct').lossRate }}</span>
                </div>

                <!-- 移动 -->
                <div class="chart-row">
                  <span class="chart-label cm">移动</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'cm')" 
                         :key="'cm-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'cm').latency }}/{{ getIspAverage(item.domain, 'cm').lossRate }}</span>
                </div>

                <!-- 联通 -->
                <div class="chart-row">
                  <span class="chart-label cu">联通</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'cu')" 
                         :key="'cu-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'cu').latency }}/{{ getIspAverage(item.domain, 'cu').lossRate }}</span>
                </div>

                <div class="chart-footer">
                     <div class="chart-legend">
                       <div class="legend-title">丢包率:</div>
                       <div class="legend-i"><span class="bit-sample green"></span> 0%</div>
                       <div class="legend-i"><span class="bit-sample yellow"></span> 0~10%</div>
                       <div class="legend-i"><span class="bit-sample red"></span> &gt;10%</div>
                       <div class="legend-i"><span class="bit-sample gray"></span> 无数据</div>
                    </div>
                    <div class="chart-val-legend">平均延迟/丢包率</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Other/Third-party -->
        <section class="domain-section">
          <div class="section-badge third">🎯 更多</div>
          <h2>第三方 / 其他优选域名</h2>
          <p class="section-desc">社区维护的优选列表，包含各类大带宽自选 IP 和反代域名。</p>
          
          <div class="domain-list">
            <div v-for="item in thirdPartyDomains" :key="item.domain" class="monitor-card">
              <!-- Left -->
              <div class="monitor-left">
                <div class="monitor-header">
                  <div class="domain-btn-orange">
                    <span class="icon">{{ getRegionFlag(item.region) }}</span> {{ item.domain }}
                  </div>
                  <button class="btn-ghost" @click="copy(item.domain)">
                    &lt; &gt; TCPing
                  </button>
                  <button class="btn-ghost" @click="checkPing(item)" :class="{'pinging': item.isPinging}">
                    <span v-if="item.realPing" :class="getPingColor(item.realPing)">{{ item.realPing }}ms</span>
                    <span v-else>{{ item.isPinging ? '...' : '📶 测速' }}</span>
                  </button>
                </div>
                
                <div class="desc-box-yellow">
                  <div class="desc-title">💡 节点说明:</div>
                  <div class="desc-content">
                    {{ item.description || '第三方维护的优选域名，请自测连通性。' }}
                  </div>
                </div>
              </div>

              <!-- Right: 24小时三网测速 (真实历史数据) -->
              <div class="monitor-right">
                <div class="chart-header">
                  <span class="chart-title">📊 全国三网参考 <span class="data-source-note">(点击左侧测速获取您的真实延迟)</span></span>
                  <a :href="'https://www.itdog.cn/tcping/' + item.domain + ':443'" target="_blank" class="tcping-link">TCPing</a>
                </div>
                
                <!-- 电信 -->
                <div class="chart-row">
                  <span class="chart-label ct">电信</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'ct')" 
                         :key="'ct-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'ct').latency }}/{{ getIspAverage(item.domain, 'ct').lossRate }}</span>
                </div>

                <!-- 移动 -->
                <div class="chart-row">
                  <span class="chart-label cm">移动</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'cm')" 
                         :key="'cm-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'cm').latency }}/{{ getIspAverage(item.domain, 'cm').lossRate }}</span>
                </div>

                <!-- 联通 -->
                <div class="chart-row">
                  <span class="chart-label cu">联通</span>
                  <div class="timeline-track">
                    <div v-for="(bit, idx) in getHistoryBits(item.domain, 'cu')" 
                         :key="'cu-'+idx" 
                         class="time-bit" 
                         :class="bit.color"
                         :title="'丢包率: ' + (bit.loss * 100).toFixed(1) + '%'">
                    </div>
                  </div>
                  <span class="chart-val">{{ getIspAverage(item.domain, 'cu').latency }}/{{ getIspAverage(item.domain, 'cu').lossRate }}</span>
                </div>

                <div class="chart-footer">
                     <div class="chart-legend">
                       <div class="legend-title">丢包率:</div>
                       <div class="legend-i"><span class="bit-sample green"></span> 0%</div>
                       <div class="legend-i"><span class="bit-sample yellow"></span> 0~10%</div>
                       <div class="legend-i"><span class="bit-sample red"></span> &gt;10%</div>
                       <div class="legend-i"><span class="bit-sample gray"></span> 无数据</div>
                    </div>
                    <div class="chart-val-legend">平均延迟/丢包率</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer class="footer">
           <p>Last Update: {{ lastUpdateTime }}</p>
        </footer>
      </main>

      <!-- 订阅生成模态框 -->
      <n-modal v-model:show="showSubscribeModal">
        <n-card
          style="width: 600px; max-width: 90%"
          title="⚡ 一键生成优选订阅"
          :bordered="false"
          size="huge"
          role="dialog"
          aria-modal="true"
        >
          <p class="modal-desc">
            输入您的原始节点链接，系统将自动使用列表中的<b>所有优选域名</b>进行裂变和负载均衡优化。
          </p>
          
          <!-- 测速状态提示 -->
          <div v-if="userSpeedCount > 0" class="speed-status-banner speed-ok">
            <span class="status-icon">✅</span>
            <div class="status-content">
              <strong>已检测到您的测速数据</strong>
              <p>将使用您测试的 {{ userSpeedCount }} 个域名延迟数据生成最优订阅</p>
            </div>
          </div>
          <div v-else class="speed-status-banner speed-warning">
            <span class="status-icon">⚠️</span>
            <div class="status-content">
              <strong>建议先进行测速</strong>
              <p>点击页面上方的"🚀 全局测速"按钮，获取基于您网络环境的真实延迟数据</p>
            </div>
          </div>
          
          <n-form-item label="原始订阅/节点链接">
             <n-input 
               v-model:value="sourceUrl" 
               type="textarea" 
               placeholder="支持 vmess://, vless://, trojan:// 或 http订阅链接"
               :rows="3"
             />
          </n-form-item>
          
          <n-form-item label="优选节点数量限制">
             <n-input-number v-model:value="maxNodes" :min="5" :max="50" style="width: 100%" />
          </n-form-item>

          <div class="advanced-options">
            <n-form-item label="最大延迟 (ms) (可选)">
                <n-input-number v-model:value="subConfig.maxLatency" placeholder="例如: 150" :step="10" style="width: 100%" />
            </n-form-item>
             <n-form-item label="包含关键词 (Regex) (可选)">
                <n-input v-model:value="subConfig.include" placeholder="例如: HK|SG|US" />
            </n-form-item>
          </div>

          <template #footer>
             <div class="modal-actions">
               <n-button type="primary" block size="large" @click="generateSub" :loading="loading">
                 立即生成
               </n-button>
             </div>
             
             <div v-if="resultAcc" class="result-box">
                <div class="result-status">{{ resultAcc }}</div>
                <div v-if="generatedSubscription" class="result-actions">
                  <n-button type="success" block @click="copyResult" style="margin-top: 10px">
                    📋 复制订阅内容（粘贴到代理客户端）
                  </n-button>
                  <div class="result-hint">
                    💡 提示：复制后，在代理客户端（如v2rayN、Clash）中创建新订阅，粘贴内容即可
                  </div>
                </div>
             </div>
          </template>
        </n-card>
      </n-modal>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { darkTheme, NConfigProvider, NButton, NTag, NModal, NCard, NInput, NInputNumber, NFormItem, GlobalTheme } from 'naive-ui'
import NetworkDashboard from './components/NetworkDashboard.vue'

// Theme State
const isDark = ref(false)
const theme = computed<GlobalTheme | null>(() => isDark.value ? darkTheme : null)

const toggleTheme = () => {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
}

// Initial Theme Setup
onMounted(() => {
    // Default to light as requested ("Bright")
    document.documentElement.setAttribute('data-theme', 'light')
})

// State
interface Domain {
    id: string;
    domain: string;
    type: string;
    description: string;
    updatedAt: string;
    speed?: number;
    region?: string; // US, HK, SG, CN, Global
    // Client-side fields
    isPinging?: boolean;
    realPing?: number;
}

const domains = ref<Domain[]>([])
const searchQuery = ref('')
const filterType = ref('all')
const sortBy = ref<'default' | 'latency'>('default')
const isGlobalPinging = ref(false)
const subConfig = ref({
    maxLatency: null as number | null,
    include: '',
    exclude: ''
})
const refreshing = ref(false)
const showSubscribeModal = ref(false)
const sourceUrl = ref('')
const maxNodes = ref(15)
const loading = ref(false)
const resultAcc = ref('')
const generatedSubscription = ref('') // Stores actual subscription content for copying

// 三网测速数据存储
interface IspSpeedData {
    ct: { latency: number; lossRate: number };
    cm: { latency: number; lossRate: number };
    cu: { latency: number; lossRate: number };
    lastUpdate: string;
}
const ispSpeedData = ref<Record<string, IspSpeedData>>({})

// 获取域名的三网测速数据
const fetchIspSpeedData = async (domain: string) => {
    try {
        const res = await fetch(`/api/isp-speed/${encodeURIComponent(domain)}`)
        const data = await res.json()
        if (data.success && data.data) {
            ispSpeedData.value[domain] = data.data
        }
    } catch (e) {
        console.error('Failed to fetch ISP speed data:', e)
    }
}

// 获取域名三网数据的辅助函数
const getIspData = (domain: string, isp: 'ct' | 'cm' | 'cu') => {
    const data = ispSpeedData.value[domain]
    if (!data) return { latency: '-', lossRate: '-' }
    return {
        latency: data[isp].latency + 'ms',
        lossRate: (data[isp].lossRate * 100).toFixed(2) + '%'
    }
}

// 批量获取三网数据（所有域名）
const fetchBatchIspSpeed = async () => {
    try {
        const domainList = domains.value.map(d => d.domain) // 获取所有域名
        console.log(`📊 Fetching ISP speed for ${domainList.length} domains...`)
        const res = await fetch('/api/isp-speed/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domains: domainList })
        })
        const data = await res.json()
        if (data.success && data.data) {
            ispSpeedData.value = { ...ispSpeedData.value, ...data.data }
        }
    } catch (e) {
        console.error('Failed to fetch batch ISP speed data:', e)
    }
}

// 24小时历史数据存储
interface HistoryPoint {
    timestamp: string;
    ct: { latency: number; lossRate: number };
    cm: { latency: number; lossRate: number };
    cu: { latency: number; lossRate: number };
}
const ispHistoryData = ref<Record<string, HistoryPoint[]>>({})

// 获取域名的24小时历史数据
const fetchIspHistory = async (domain: string) => {
    try {
        const res = await fetch(`/api/isp-history/${encodeURIComponent(domain)}`)
        const data = await res.json()
        if (data.success && data.history) {
            ispHistoryData.value[domain] = data.history
        }
    } catch (e) {
        console.error('Failed to fetch ISP history:', e)
    }
}

// 批量获取历史数据（所有域名）
const fetchBatchIspHistory = async () => {
    const domainList = domains.value.map(d => d.domain) // 获取所有域名
    console.log(`📊 Fetching ISP history for ${domainList.length} domains...`)
    for (const domain of domainList) {
        await fetchIspHistory(domain)
    }
    console.log('✅ ISP history loaded')
}

// 获取历史数据用于图表显示（返回72个点，不足的补灰色）
const getHistoryBits = (domain: string, isp: 'ct' | 'cm' | 'cu') => {
    const history = ispHistoryData.value[domain] || []
    const bits: Array<{ color: string; loss: number }> = []
    
    // 填充历史数据点
    for (const point of history) {
        const lossRate = point[isp].lossRate
        let color = 'bit-green'
        if (lossRate > 0.1) color = 'bit-red'
        else if (lossRate > 0) color = 'bit-yellow'
        bits.push({ color, loss: lossRate })
    }
    
    // 不足72个点的补空
    while (bits.length < 72) {
        bits.unshift({ color: 'bit-empty', loss: 0 })
    }
    
    return bits.slice(-72) // 只取最近72个点
}

// 计算ISP平均延迟和丢包率
const getIspAverage = (domain: string, isp: 'ct' | 'cm' | 'cu') => {
    const history = ispHistoryData.value[domain] || []
    if (history.length === 0) {
        // 没有历史数据时使用当前数据
        const current = ispSpeedData.value[domain]
        if (!current) return { latency: '-', lossRate: '-' }
        return {
            latency: current[isp].latency + 'ms',
            lossRate: (current[isp].lossRate * 100).toFixed(2) + '%'
        }
    }
    
    const total = history.reduce((acc, p) => ({
        latency: acc.latency + p[isp].latency,
        loss: acc.loss + p[isp].lossRate
    }), { latency: 0, loss: 0 })
    
    return {
        latency: Math.round(total.latency / history.length) + 'ms',
        lossRate: ((total.loss / history.length) * 100).toFixed(2) + '%'
    }
}


// Computed Grouping
// Computed Grouping with Filter & Sort
const filteredDomains = computed(() => {
  let res = domains.value
  
  // 1. Filter by Type
  if (filterType.value !== 'all') {
    if (filterType.value === 'official') res = res.filter(d => d.type === 'official' || !d.type)
    else res = res.filter(d => d.type === filterType.value)
  }
  
  // 2. Filter by Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    res = res.filter(d => d.domain.toLowerCase().includes(q) || (d.description && d.description.toLowerCase().includes(q)))
  }

  // 3. Sort
  if (sortBy.value === 'latency') {
    // Clone to avoid mutating original order during sort
    res = [...res].sort((a, b) => {
        const pingA = a.realPing || 9999
        const pingB = b.realPing || 9999
        return pingA - pingB
    })
  }

  return res
})

const officialDomains = computed(() => filteredDomains.value.filter((d: Domain) => d.type === 'official' || !d.type))
const cmDomains = computed(() => filteredDomains.value.filter((d: Domain) => d.type === 'cm'))
const thirdPartyDomains = computed(() => filteredDomains.value.filter((d: Domain) => d.type === 'third-party'))

// Count domains with user's speed test data
const userSpeedCount = computed(() => {
  return domains.value.filter((d: Domain) => d.realPing !== undefined && d.realPing > 0).length
})

// Check if user has tested any domains
const hasTestedSpeed = computed(() => userSpeedCount.value > 0)
const testedCount = computed(() => userSpeedCount.value)

const lastUpdateTime = computed(() => {
    if (domains.value.length > 0) {
        return new Date(domains.value[0].updatedAt).toLocaleString()
    }
    return 'Loading...'
})

// Actions
const fetchDomains = async () => {
    try {
        const res = await fetch('/api/domains')
        const json = await res.json()
        if (json.success) {
            domains.value = json.data.map((d: Domain) => ({
                ...d,
                // Mock regions for demo if backend doesn't provide
                region: d.type === 'official' ? 'Global' : (d.type === 'cm' ? 'HK' : 'US') 
            }))
        }
    } catch(e) {
        console.error(e)
    }
}

const refreshDomains = async () => {
    refreshing.value = true
    try {
        await fetch('/api/refresh', { method: 'POST' })
        await fetchDomains()
        // alert('已刷新最新域名列表')
    } catch {
        console.error('刷新失败')
    } finally {
        refreshing.value = false
    }
}

const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    // alert('已复制: ' + text)
}

const getSpeedClass = (ms: number) => {
    if(ms < 100) return 'speed-fast'
    if(ms < 200) return 'speed-medium'
    return 'speed-slow'
}

const getWidth = (ms: number, factor: number = 1) => {
    if(!ms) return '0%'
    const val = ms * factor
    return Math.min(val / 5, 100) + '%'
}

const getBitClass = (baseSpeed: number, index: number, factor: number = 1) => {
    // Simulate some variation in the bit map
    if (!baseSpeed || baseSpeed === 9999) return 'bit-gray'
    
    // Add randomness based on index to make it look like a timeline
    const variance = (index % 3 === 0) ? 0.2 : 0; 
    const speed = baseSpeed * factor * (1 + variance);
    
    // Simulate random packet loss (gray blocks) occasionally
    if (Math.random() > 0.95) return 'bit-gray'

    if (speed < 100) return 'bit-green'
    if (speed < 200) return 'bit-yellow'
    return 'bit-red'
}

const formatLatency = (baseSpeed: number, factor: number = 1) => {
    if (!baseSpeed || baseSpeed === 9999) return '--/100%'
    const speed = Math.round(baseSpeed * factor)
    // Simulate a loss rate proportional to speed/randomness for display
    // e.g. lower speed = lower loss
    const loss = (Math.random() * (speed > 200 ? 10 : 1)).toFixed(2)
    return `${speed}ms/${loss}%`
}

const generateSub = async () => {
    if(!sourceUrl.value) {
        alert('请输入原始链接')
        return
    }
    loading.value = true
    try {
        // Collect user's speed test data from all domains
        const userSpeedData: Record<string, number> = {}
        domains.value.forEach((domain: Domain) => {
            if (domain.realPing !== undefined && domain.realPing > 0) {
                userSpeedData[domain.domain] = domain.realPing
            }
        })

        // Check if user has tested speeds
        if (Object.keys(userSpeedData).length === 0) {
            const confirmed = confirm('⚠️ 您还没有进行测速！\n\n建议先点击"🚀 全局测速"按钮，这样生成的订阅才是基于您网络环境的最优节点。\n\n点击"确定"继续（使用默认数据），点击"取消"去测速。')
            if (!confirmed) {
                loading.value = false
                return
            }
        }

        // Prepare request body with user's speed data
        const requestBody = {
            url: sourceUrl.value,
            max: maxNodes.value,
            max_latency: subConfig.value.maxLatency,
            include: subConfig.value.include,
            exclude: subConfig.value.exclude,
            userSpeedData: Object.keys(userSpeedData).length > 0 ? userSpeedData : undefined
        }

        // Send POST request to backend - this uses user's speed data!
        const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
            throw new Error('订阅生成失败')
        }

        const subscriptionContent = await response.text()
        
        // Create a blob URL for direct download/copy
        const blob = new Blob([subscriptionContent], { type: 'text/plain;charset=utf-8' })
        const blobUrl = URL.createObjectURL(blob)
        
        // Store the actual content for copying
        generatedSubscription.value = subscriptionContent
        
        // For display, show a hint that this is optimized based on their network
        if (Object.keys(userSpeedData).length > 0) {
            resultAcc.value = `✅ 已基于您的 ${Object.keys(userSpeedData).length} 个域名测速结果生成优选订阅（共${subscriptionContent.split('\n').length}个节点）`
        } else {
            resultAcc.value = `⚠️ 使用默认数据生成订阅（建议下次先测速）`
        }
        
    } catch(e) {
        alert('生成失败: ' + (e as Error).message)
    } finally {
        loading.value = false
    }
}

const copyResult = () => {
    if (generatedSubscription.value) {
        navigator.clipboard.writeText(generatedSubscription.value)
        alert('✅ 订阅内容已复制到剪贴板！\n\n请粘贴到代理客户端的订阅框中。')
    } else {
        alert('请先生成订阅')
    }
}

const checkPing = async (item: Domain) => {
    item.isPinging = true
    item.realPing = undefined
    const start = performance.now()
    try {
        // Use Image load trick for rough latency estimation (CORS safe-ish)
        const img = new Image()
        const protocol = window.location.protocol === 'https:' ? 'https://' : 'http://'
        
        const p = new Promise<void>((resolve, reject) => {
            img.onload = () => resolve()
            img.onerror = () => resolve() // Error is fine, we just want connection time
            setTimeout(() => reject(), 5000) // 5s timeout
        })
        
        img.src = `${protocol}${item.domain}/favicon.ico?t=${Date.now()}`
        
        await p
        const end = performance.now()
        item.realPing = Math.round(end - start)
    } catch {
        item.realPing = 9999 // Timeout
    } finally {
        item.isPinging = false
        
        // Save to localStorage for history chart
        if (item.realPing !== undefined) {
            savePingHistory(item.domain, item.realPing)
        }
    }
}

// Save ping history to localStorage (max 40 data points per domain)
const savePingHistory = (domain: string, latency: number) => {
    const key = `ping_history_${domain}`
    let history: { time: number; latency: number }[] = []
    
    try {
        const stored = localStorage.getItem(key)
        if (stored) {
            history = JSON.parse(stored)
        }
    } catch {
        history = []
    }
    
    // Add new data point
    history.push({
        time: Date.now(),
        latency: latency
    })
    
    // Keep only last 40 data points
    if (history.length > 40) {
        history = history.slice(-40)
    }
    
    localStorage.setItem(key, JSON.stringify(history))
}

// Get ping history from localStorage
const getPingHistory = (domain: string): { time: number; latency: number }[] => {
    const key = `ping_history_${domain}`
    try {
        const stored = localStorage.getItem(key)
        if (stored) {
            return JSON.parse(stored)
        }
    } catch {
        // ignore
    }
    return []
}

const pingAll = async () => {
    // 确保域名已加载
    if (domains.value.length === 0) {
        console.log('Domains not loaded yet, fetching...')
        await fetchDomains()
    }
    
    if (domains.value.length === 0) {
        console.warn('No domains available for testing')
        return
    }
    
    isGlobalPinging.value = true
    console.log(`Starting global ping test for ${domains.value.length} domains...`)
    
    const pings = domains.value.map(d => checkPing(d))
    await Promise.allSettled(pings)
    
    isGlobalPinging.value = false
    console.log('Global ping test completed')
}

const getPingColor = (ms: number) => {
    if (ms < 100) return 'text-green'
    if (ms < 300) return 'text-yellow'
    return 'text-red'
}

const getRegionFlag = (region?: string) => {
    switch(region) {
        case 'US': return '🇺🇸'
        case 'HK': return '🇭🇰'
        case 'SG': return '🇸🇬'
        case 'JP': return '🇯🇵'
        case 'Global': return '🌐'
        default: return '🌐'
    }
}

// Get user's ping history for display (wrapper function for template)
const getUserPingHistory = (domain: string) => {
    return getPingHistory(domain)
}

// Get CSS class for history chart bit based on latency
const getHistoryBitClass = (latency: number) => {
    if (latency >= 9999) return 'bit-gray'
    if (latency < 100) return 'bit-green'
    if (latency < 300) return 'bit-yellow'
    return 'bit-red'
}

// Get CSS class for ISP chart bit based on loss rate
const getIspBitClass = (domain: string, isp: 'ct' | 'cm' | 'cu', n: number) => {
    const data = ispSpeedData.value[domain]
    if (!data) return 'bit-empty'
    
    const lossRate = data[isp].lossRate
    // Add some randomness to simulate 24h data variance
    const variance = Math.sin(n * 0.5 + domain.length) * 0.3
    const adjustedLoss = Math.max(0, lossRate + variance)
    
    if (adjustedLoss <= 0) return 'bit-green'
    if (adjustedLoss < 0.1) return 'bit-yellow'
    if (adjustedLoss < 0.5) return 'bit-red'
    return 'bit-gray'
}

// Calculate average latency from history
const getAvgLatency = (domain: string) => {
    const history = getPingHistory(domain)
    if (history.length === 0) return '-'
    
    const validPings = history.filter(h => h.latency < 9999)
    if (validPings.length === 0) return '超时'
    
    const avg = Math.round(validPings.reduce((sum, h) => sum + h.latency, 0) / validPings.length)
    return `${avg}ms`
}

onMounted(async () => {
    await fetchDomains()
    // 获取三网测速数据
    fetchBatchIspSpeed()
    // 获取24小时历史数据
    fetchBatchIspHistory()
    
    // 🔄 自动刷新：每5分钟自动刷新域名和三网数据
    setInterval(() => {
        console.log('🔄 Auto-refreshing domains and ISP data...')
        fetchDomains()
        fetchBatchIspSpeed()
        fetchBatchIspHistory()
    }, 5 * 60 * 1000) // 5分钟
})
</script>



<style scoped>
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  padding: 20px 0;
}
</style>

<!-- Global Theme Styles (Non-scoped) -->
<style>
/* Global Styles & Theming */
:root {
  /* Light Mode (Default) */
  --bg-body: #ffffff;
  --bg-card: #ffffff;
  --bg-glass: rgba(255, 255, 255, 0.9);
  --text-primary: #333333;
  --text-secondary: #666666;
  --border-color: #e5e5e5;
  --glass-border: rgba(0, 0, 0, 0.05); /* Very subtle border for light mode */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --code-color: #0d9488;
  --bg-chart: #f9fafb; /* Light gray for chart area */
}

[data-theme='dark'] {
  /* Dark Mode */
  --bg-body: #111827; /* Dark Blue-Gray */
  --bg-card: #1f2937;
  --bg-glass: rgba(31, 41, 55, 0.8);
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --border-color: #374151;
  --glass-border: rgba(255, 255, 255, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  --code-color: #a5f3fc;
  --bg-chart: #131b26; /* Darker than card for contrast */
}

body {
  margin: 0;
  background-color: var(--bg-body);
  color: var(--text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  min-height: 100vh;
}
</style>

<style scoped>

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
}

.glass-panel {
  background: var(--bg-glass);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--glass-border);
}

.monitor-card {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary);
}

.theme-toggle-btn {
  margin-right: 15px;
  font-size: 1.2rem;
}

/* 🔥 Speed Test Banner Styles */
.speed-test-banner {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border-radius: 12px;
  padding: 20px 25px;
  margin-bottom: 20px;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}

.banner-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.banner-icon {
  font-size: 2.5rem;
}

.banner-text {
  min-width: 200px;
}

.banner-text strong {
  display: block;
  font-size: 1.2rem;
  color: white;
  margin-bottom: 5px;
}

.banner-text p {
  margin: 0;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.9rem;
}

/* 大号测速按钮 */
.big-test-btn {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 18px 40px;
  font-size: 1.3rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
  min-width: 220px;
  text-align: center;
}

.big-test-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(34, 197, 94, 0.5);
}

.big-test-btn:disabled {
  opacity: 0.9;
  cursor: wait;
}

.testing-status {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 测速完成状态 */
.speed-test-done {
  background: rgba(34, 197, 94, 0.1);
  border: 2px solid rgba(34, 197, 94, 0.4);
  border-radius: 10px;
  padding: 15px 25px;
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  flex-wrap: wrap;
}

.speed-test-done span {
  color: #22c55e;
  font-weight: 600;
  font-size: 1rem;
}

.retest-btn {
  background: transparent;
  border: 2px solid #3b82f6;
  color: #3b82f6;
  border-radius: 6px;
  padding: 10px 20px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.retest-btn:hover:not(:disabled) {
  background: #3b82f6;
  color: white;
}

.retest-btn:disabled {
  opacity: 0.7;
  cursor: wait;
}

/* 大号重新测速按钮 */
.big-retest-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 14px 30px;
  font-size: 1.1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
}

.big-retest-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
}

.big-retest-btn:disabled {
  opacity: 0.9;
  cursor: wait;
}

/* Update previous styles to use variables */
.subtitle {
  color: var(--text-secondary);
}

@media (min-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
}

.input-section {
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: fit-content;
}

.subtitle {
  color: var(--text-secondary);
  margin-top: -10px;
  margin-bottom: 10px;
  font-size: 0.9rem;
}

.hero-actions {
  display: flex;
  justify-content: center;
  margin-top: 30px;
  margin-bottom: 20px;
}

.pulsing-button {
  width: 100%;
  max-width: 800px;
  height: 120px;
  font-size: 2rem;
  letter-spacing: 2px;
  font-weight: bold;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 12px;
  box-shadow: 0 0 25px rgba(16, 185, 129, 0.5);
  transition: all 0.3s ease;
}

.pulsing-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 35px rgba(16, 185, 129, 0.7);
}

.refresh-btn-styled {
  background: transparent !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
  font-weight: normal;
  height: 34px; /* Match typical icon button height */
  padding: 0 15px;
  border-radius: 20px; /* Pillow shape */
  box-shadow: none;
  transition: all 0.3s ease;
}

.refresh-btn-styled:hover {
  background: rgba(59, 130, 246, 0.1) !important;
  color: #3b82f6 !important;
  border-color: #3b82f6 !important;
  transform: translateY(-1px);
}

.icon-flash {
  display: inline-block;
  animation: flash 2s infinite;
}

@keyframes flash {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.2); }
}

.action-row {
  margin-top: 10px;
}

.result-box {
  background: var(--bg-card);
  padding: 15px;
  margin-top: 20px;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.result-code {
  word-break: break-all;
  font-family: monospace;
  color: var(--code-color);
}

.result-status {
  font-size: 0.95rem;
  padding: 10px;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 6px;
  text-align: center;
}

.result-actions {
  margin-top: 15px;
}

.result-hint {
  margin-top: 10px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.8;
  text-align: center;
}

.speed-status-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 16px;
  border-radius: 8px;
  margin: 16px 0;
  border: 1px solid;
}

.speed-status-banner .status-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.speed-status-banner .status-content {
  flex: 1;
}

.speed-status-banner .status-content strong {
  display: block;
  margin-bottom: 4px;
  font-size: 14px;
}

.speed-status-banner .status-content p {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
  line-height: 1.4;
}

.speed-ok {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
  color: #16a34a;
}

.speed-warning {
  background: rgba(251, 146, 60, 0.1);
  border-color: rgba(251, 146, 60, 0.3);
  color: #ea580c;
}

[data-theme="dark"] .speed-ok {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.4);
  color: #4ade80;
}

[data-theme="dark"] .speed-warning {
  background: rgba(251, 146, 60, 0.15);
  border-color: rgba(251, 146, 60, 0.4);
  color: #fb923c;
}

.list-section {
  padding: 30px;
  min-height: 500px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

/* Naive UI Overrides for Theme Compatibility */
:deep(.n-data-table) {
  background: transparent !important;
}
:deep(.n-data-table th) {
  background: var(--bg-card) !important;
  color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border-color) !important;
}
:deep(.n-data-table td) {
  background: transparent !important;
  color: var(--text-secondary) !important;
  border-bottom: 1px solid var(--border-color) !important;
}
:deep(.n-data-table:hover td) {
  background: rgba(0, 0, 0, 0.02) !important; /* Very subtle hover */
}
[data-theme='dark'] :deep(.n-data-table:hover td) {
    background: rgba(255, 255, 255, 0.05) !important;
}

.speed-tag {
    font-size: 0.8rem;
    margin-left: auto;
    font-weight: bold;
}
.speed-fast { color: #86efac; }
.speed-medium { color: #fde047; }
.speed-slow { color: #fca5a5; }

.card-header {
    display: flex;
    align-items: center;
    gap: 8px;
}


.monitor-card {
  display: flex;
  background: var(--bg-card);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

/* LEFT PANEL */
.monitor-left {
    flex: 6;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.monitor-header {
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
}

.domain-btn-orange {
    background: linear-gradient(to right, #fb923c, #ea580c);
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-weight: bold;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 5px rgba(234, 88, 12, 0.3);
}

.tag-group {
    display: flex;
    gap: 10px;
}

.tag-pill {
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.8rem;
    border: 1px solid transparent;
}
.tag-pill.soft {
    border: 1px solid #fb923c;
    color: #fb923c;
}
.tag-pill.pink {
    background: #f43f5e;
    color: white;
}

.btn-ghost {
    background: transparent;
    border: 1px solid #52525b;
    color: #a1a1aa;
    padding: 4px 12px;
    border-radius: 4px;
    cursor: pointer;
    margin-left: auto;
}
.btn-ghost:hover {
    border-color: #fb923c;
    color: #fb923c;
}

.desc-box-yellow {
    background: #fef9c3;
    border-left: 5px solid #eab308;
    color: #854d0e;
    padding: 15px;
    border-radius: 4px;
    font-size: 0.9rem;
    flex: 1; /* fill remaining height */
}
/* In dark mode, adjust yellow box */
/* In dark mode, adjust yellow box */
[data-theme='dark'] .desc-box-yellow {
    background: rgba(234, 179, 8, 0.15); /* Slightly stronger yellow tint */
    color: #e5e7eb; /* Brighter text (Gray-200) */
    border-left-color: #facc15; /* Brighter yellow border */
}

.desc-title {
    font-weight: bold;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    color: #ca8a04;
}
[data-theme='dark'] .desc-title {
    color: #fde047; /* Bright yellow in dark mode */
}

.desc-content ul {
    margin: 5px 0;
    padding-left: 20px;
    color: inherit;
}

/* RIGHT PANEL */
.monitor-right {
    flex: 5;
    background: var(--bg-chart); /* Adapt to theme */
    border-left: 1px solid var(--border-color);
    padding: 15px 25px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
/* Dark mode override removed as variables handle it */

.chart-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20px;
    font-size: 0.9rem;
}

.chart-title {
    font-weight: bold;
}

.data-source-note {
    font-size: 0.75rem;
    color: #f97316;
    font-weight: normal;
}

.chart-time {
    color: var(--text-secondary);
    font-size: 0.8rem;
}

.chart-row {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 12px;
}

.chart-label {
    width: 40px;
    font-weight: bold;
    font-size: 0.9rem;
}

.timeline-track {
    flex: 1;
    display: flex;
    gap: 2px;
    height: 12px;
}

.time-bit {
    flex: 1;
    border-radius: 1px;
}
.bit-gray { background: var(--border-color); }
.bit-green { background: #4ade80; }
.bit-yellow { background: #facc15; }
.bit-red { background: #ef4444; }
.bit-empty { background: var(--border-color); opacity: 0.3; }

[data-theme='dark'] .bit-gray { background: #334155; }
[data-theme='dark'] .bit-empty { background: #1e293b; opacity: 0.5; }

.history-stats {
  display: flex;
  gap: 20px;
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 10px;
}

.history-empty {
  font-size: 0.85rem;
  color: var(--text-secondary);
  opacity: 0.7;
  margin-top: 10px;
  font-style: italic;
}

.chart-val {
    width: 100px;
    text-align: right;
    color: var(--text-secondary);
    font-family: monospace;
    font-size: 0.75rem;
}

/* TCPing Link */
.tcping-link {
    font-size: 0.75rem;
    color: #3b82f6;
    text-decoration: none;
    padding: 2px 8px;
    border: 1px solid #3b82f6;
    border-radius: 4px;
    transition: all 0.2s;
}

.tcping-link:hover {
    background: #3b82f6;
    color: white;
}

/* ISP Label Colors */
.chart-label.ct { color: #22c55e; } /* 电信 - 绿色 */
.chart-label.cm { color: #3b82f6; } /* 移动 - 蓝色 */
.chart-label.cu { color: #f97316; } /* 联通 - 橙色 */

.chart-legend {
    display: flex;
    gap: 20px;
    margin-top: 15px;
    font-size: 0.75rem;
    color: var(--text-secondary);
    justify-content: flex-start;
}
.legend-i {
    display: flex;
    align-items: center;
    gap: 5px;
}
.bit-sample {
    width: 8px;
    height: 8px;
}
.bit-sample.green { background: #4ade80; }
.bit-sample.yellow { background: #facc15; }
.bit-sample.red { background: #ef4444; }
.bit-sample.gray { background: #52525b; }

.chart-title-group {
    display: flex;
    flex-direction: column;
}
.chart-main-title {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 4px;
}
.chart-sub-title {
    font-size: 1rem;
    font-weight: bold;
    color: var(--text-primary);
}

.time-axis {
    display: flex;
    justify-content: space-between;
    margin-left: 55px; /* align with track */
    margin-right: 95px; /* align with track end */
    color: var(--text-secondary);
    font-size: 0.75rem;
    margin-top: 5px;
    margin-bottom: 10px;
}

.advanced-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}
.chart-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 5px;
    font-size: 0.75rem;
    color: var(--text-secondary);
}

.chart-val-legend {
    margin-right: 10px;
}

/* duplicate chart-val rule removed */

@media (max-width: 900px) {
    .monitor-card { flex-direction: column; }
    .monitor-right { border-left: none; border-top: 1px solid var(--border-color); }
}

/* Filter Section Styles */
.filter-section {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 15px 25px;
  margin: 0 auto 30px;
  max-width: 900px;
  border-radius: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.search-box {
  display: flex;
  align-items: center;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 8px 12px;
  flex: 1;
  min-width: 200px;
}

.search-icon {
  margin-right: 8px;
  opacity: 0.5;
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  font-size: 1rem;
  color: var(--text-primary);
  width: 100%;
}

.filter-tags {
  display: flex;
  gap: 10px;
}

.filter-tag {
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.9rem;
  cursor: pointer;
  background: var(--bg-body);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  transition: all 0.2s;
}

.filter-tag:hover {
  background: var(--border-color);
}

.filter-tag.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.ping-all-btn {
  margin-left: auto;
}

/* Ping Result Colors */
.text-green { color: #10b981; font-weight: bold; }
.text-yellow { color: #f59e0b; font-weight: bold; }
.text-red { color: #ef4444; font-weight: bold; }

@media (max-width: 768px) {
  .filter-section {
    flex-direction: column;
    align-items: flex-start;
  }
  .search-box {
    width: 100%;
  }
}
</style>

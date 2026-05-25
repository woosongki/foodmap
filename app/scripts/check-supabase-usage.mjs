// Supabase Free tier 사용량 체크
// 사용: node scripts/check-supabase-usage.mjs

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.join(__dirname, '..')

async function loadEnv() {
  const text = await fs.readFile(path.join(APP_ROOT, '.env.local'), 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    env[t.slice(0, i)] = t.slice(i + 1).trim()
  }
  return env
}
const env = await loadEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

// ─── Free tier 한도 ─────────────────────────────────────────
const LIMITS = {
  db_size_mb: 500,
  egress_gb_per_month: 5,
  storage_gb: 1,
  mau: 50000,
  realtime_concurrent: 200,
}

// ─── 1. 각 테이블 row count + 크기 추정 ──────────────────────
const TABLES = {
  restaurants:        { avgBytes: 500,  description: '내 맛집' },
  tags:               { avgBytes: 80,   description: '태그' },
  photos:             { avgBytes: 250,  description: '사진 URL' },
  external_landmarks: { avgBytes: 200,  description: '백년가게 등 외부' },
}

console.log('═'.repeat(60))
console.log('Supabase Free tier 사용량 진단')
console.log('═'.repeat(60))
console.log()

let totalBytes = 0
console.log('📊 테이블별 사용량 (추정)')
console.log('─'.repeat(60))
console.log('테이블'.padEnd(20) + '행'.padStart(8) + '추정크기'.padStart(14) + '  설명')
console.log('─'.repeat(60))

for (const [table, meta] of Object.entries(TABLES)) {
  try {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    const bytes = (count || 0) * meta.avgBytes
    totalBytes += bytes
    const sizeStr = bytes < 1024 ? `${bytes}B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1024 / 1024).toFixed(2)}MB`
    console.log(
      table.padEnd(20) +
      String(count || 0).padStart(8) +
      sizeStr.padStart(14) +
      `  ${meta.description}`
    )
  } catch (e) {
    console.log(`${table.padEnd(20)} 조회 실패: ${e.message}`)
  }
}

console.log('─'.repeat(60))
const totalMB = totalBytes / 1024 / 1024
console.log('합계'.padEnd(20) + ' '.repeat(8) + `${totalMB.toFixed(2)}MB`.padStart(14))
console.log()

// ─── 2. status / source / city 분포 ─────────────────────────
console.log('📈 데이터 분포')
console.log('─'.repeat(60))

const { data: rData } = await supabase
  .from('restaurants')
  .select('status, source, recommender')
const visited = rData?.filter(r => r.status === 'visited').length || 0
const wishlist = rData?.filter(r => r.status === 'wishlist').length || 0
const fromNotion = rData?.filter(r => r.recommender === '노션 리스트').length || 0
const fromNaver = rData?.filter(r => r.recommender === '네이버 별표').length || 0
const fromSelf = rData?.filter(r => !r.recommender || r.recommender === '').length || 0

console.log(`내 맛집: 방문 ${visited} / 위시 ${wishlist}`)
console.log(`  └ 노션 출처: ${fromNotion}개`)
console.log(`  └ 네이버 출처: ${fromNaver}개`)
console.log(`  └ 직접 등록: ${fromSelf}개`)

const { data: lData } = await supabase
  .from('external_landmarks')
  .select('layer_type, city')
const baekCount = lData?.filter(l => l.layer_type === 'baeknyeon').length || 0
console.log(`외부 레이어: 백년가게 ${baekCount}개`)
console.log()

// ─── 3. Free tier 한도 대비 ─────────────────────────────────
console.log('🆓 Free tier 한도 대비')
console.log('─'.repeat(60))

const dbUsagePct = (totalMB / LIMITS.db_size_mb) * 100
const dbBar = '█'.repeat(Math.min(Math.floor(dbUsagePct / 5), 20)) + '░'.repeat(20 - Math.min(Math.floor(dbUsagePct / 5), 20))
console.log(`DB 크기:   ${dbBar} ${totalMB.toFixed(2)} / ${LIMITS.db_size_mb}MB  (${dbUsagePct.toFixed(2)}%)`)
console.log(`           ${dbUsagePct < 10 ? '✅ 매우 여유' : dbUsagePct < 50 ? '✅ 여유' : dbUsagePct < 80 ? '⚠️ 주의' : '🚨 임박'}`)
console.log()

console.log('Egress (월간 전송량):')
console.log('  📍 정확한 수치는 Supabase 대시보드에서 확인:')
console.log(`  → https://supabase.com/dashboard/project/arxpepynyenotpgjkazq/settings/billing/usage`)
console.log()
console.log('  추정 (최적화 적용 후):')
console.log('  - 첫 방문 1회당: ~250KB (restaurants + tags만, lazy load)')
console.log('  - 새로고침 30분 내: 0KB (localStorage 캐시)')
console.log('  - 백년가게: 0KB (정적 JSON, Vercel CDN)')
console.log('  - 핀 클릭 시: ~5KB (photos/memo만)')
console.log()
console.log('  가족·지인 5명 매일 2회 사용 가정 시:')
console.log('  - 캐시 미사용 환경: 5 × 2 × 30 × 250KB = 75MB/월')
console.log('  - 캐시 사용 시: 5 × 1 (1일 1회만 실제 호출) × 30 × 250KB = 37.5MB/월')
console.log(`  - Free tier 한도: ${LIMITS.egress_gb_per_month}GB/월 (=${LIMITS.egress_gb_per_month * 1024}MB)`)
console.log(`  - 예상 사용률: 약 0.7~1.5% (매우 여유)`)
console.log()

console.log('🔍 기타 한도')
console.log('─'.repeat(60))
console.log(`Auth MAU:        본 앱은 인증 미사용 → 0 / ${LIMITS.mau.toLocaleString()} ✅`)
console.log(`Storage:         사진은 외부 URL → 0 / ${LIMITS.storage_gb}GB ✅`)
console.log(`Realtime:        본 앱은 미사용 → 0 / ${LIMITS.realtime_concurrent} ✅`)
console.log()

// ─── 4. 권장사항 ────────────────────────────────────────────
console.log('💡 권장사항')
console.log('─'.repeat(60))

if (dbUsagePct < 1) {
  console.log('✅ DB 크기는 0.x% 수준. 매우 여유롭습니다.')
}
console.log('✅ 캐싱 + 정적 JSON + select 최적화 적용 완료 (이전 커밋 1f0877b)')
console.log()
console.log('📊 실제 egress는 Supabase 대시보드에서 1~2일 추이 모니터링 권장:')
console.log('   1. Settings → Usage → "Egress" 그래프')
console.log('   2. 일일 사용량이 50MB 이하면 안전')
console.log('   3. "Cached Egress" 항목도 별도 확인')
console.log()
console.log('🚨 만약 cached egress가 계속 임박한다면:')
console.log('   - Service Worker로 PWA화 (오프라인 영구 캐싱)')
console.log('   - Cloudflare Workers + KV 캐싱 레이어')
console.log()
console.log('═'.repeat(60))

// 백년가게 데이터를 Supabase → 정적 JSON 파일로 추출
// 사용: node scripts/export-baeknyeon-json.mjs
//
// 목적: Supabase Free tier egress 절약
// - 백년가게 674개는 거의 변하지 않는 정적 데이터 (연 1회 업데이트)
// - 매번 Supabase 호출 대신 Vercel CDN이 정적 파일 서빙
// - egress: 100% 절감 (백년가게 부분)
//
// 재실행: 백년가게 데이터를 다시 시드한 후 한 번 더 실행하면 됨

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

// 백년가게 데이터 추출 — 필요한 필드만
const { data, error } = await supabase
  .from('external_landmarks')
  .select('id, name, address, lat, lng, layer_type, city, source_url')
  .eq('layer_type', 'baeknyeon')

if (error) {
  console.error('❌ Supabase 조회 실패:', error.message)
  process.exit(1)
}

console.log(`✅ ${data.length}개 백년가게 조회 완료`)

// 시·도별 통계
const cityStats = {}
for (const r of data) {
  cityStats[r.city] = (cityStats[r.city] || 0) + 1
}
console.log('시·도 분포:')
Object.entries(cityStats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
  console.log(`  ${c.padEnd(4)}: ${n}개`)
})

// public/baeknyeon.json으로 저장
const outPath = path.join(APP_ROOT, 'public', 'baeknyeon.json')
await fs.writeFile(outPath, JSON.stringify(data), 'utf8')

const stats = await fs.stat(outPath)
console.log(`\n📦 ${outPath} (${(stats.size / 1024).toFixed(1)}KB)`)
console.log(`\n🎉 완료. Vercel 배포 후 /baeknyeon.json 으로 접근 가능`)
console.log(`   → Supabase egress 절감: 백년가게 트래픽 100%`)

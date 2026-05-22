// 모호 케이스 사용자 결정 반영 스크립트
// 사용: node scripts/finalize-baeknyeon.mjs

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

// 사용자 결정 — 포함할 항목 (떡집·방앗간 8 + 커피박물관 1 = 9)
const INCLUDE_NAMES = [
  '궁중 떡집', '용인떡집', '자인방앗간', '온정떡집',
  '송림병', '㈜여의도떡방', '고향떡집', '떡서방콩고물각시',
  '왈츠와닥터만',
]

const ambPath = path.join(APP_ROOT, 'supabase', 'seed-data', 'baeknyeon_ambiguous.json')
const ambiguous = JSON.parse(await fs.readFile(ambPath, 'utf8'))

const toInsert = ambiguous.filter(a => INCLUDE_NAMES.includes(a.name))
const excluded = ambiguous.filter(a => !INCLUDE_NAMES.includes(a.name))

console.log(`결정 반영: 추가 ${toInsert.length}개, 제외 ${excluded.length}개`)
toInsert.forEach(r => console.log(`  + ${r.name} (${r._category || '카테고리 없음'})`))

const cleanRows = toInsert.map(({ _category, _matched_name, ...rest }) => rest)
const { error } = await supabase.from('external_landmarks').insert(cleanRows)
if (error) {
  console.error('❌ Supabase 저장 실패:', error.message)
  process.exit(1)
}
console.log(`\n🎉 ${toInsert.length}개 추가 완료 (모호 → 식당)`)

// 최종 카운트 확인
const { count } = await supabase
  .from('external_landmarks')
  .select('*', { count: 'exact', head: true })
  .eq('layer_type', 'baeknyeon')
console.log(`현재 백년가게 총 ${count}개 저장됨`)

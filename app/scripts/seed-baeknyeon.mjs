// 백년가게 시드 스크립트
// 사용: node scripts/seed-baeknyeon.mjs
//
// 동작:
// 1. supabase/seed-data/baeknyeon_utf8.csv 읽기
// 2. 서울/경기 필터링
// 3. 네이버 지역 검색 API로 업체명 + 주소 검색 → 좌표 획득
// 4. Supabase external_landmarks 테이블에 일괄 INSERT (기존 baeknyeon 데이터는 삭제 후 재삽입)
// 5. 실패 케이스는 baeknyeon_failed.json에 저장

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.join(__dirname, '..')

// ─── .env.local 파싱 ─────────────────────────────────────────
async function loadEnv() {
  const envPath = path.join(APP_ROOT, '.env.local')
  const text = await fs.readFile(envPath, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).trim()
  }
  return env
}

const env = await loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY
const NAVER_CLIENT_ID = env.NAVER_CLIENT_ID
const NAVER_CLIENT_SECRET = env.NAVER_CLIENT_SECRET

if (!SUPABASE_URL || !SUPABASE_KEY || !NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
  console.error('❌ .env.local에 필수 환경변수가 없습니다.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─── CSV 읽기 ────────────────────────────────────────────────
const csvPath = path.join(APP_ROOT, 'supabase', 'seed-data', 'baeknyeon_utf8.csv')
const csvText = await fs.readFile(csvPath, 'utf8')

// RFC 4180 호환 CSV 파서 (따옴표 내 콤마 처리)
function parseCSV(text) {
  const rows = []
  let cur = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++ }
        else { inQuotes = false }
      } else {
        cell += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cur.push(cell); cell = '' }
      else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = '' }
      else if (ch === '\r') { /* skip */ }
      else cell += ch
    }
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur) }
  return rows.filter(r => r.length > 1 || (r[0] && r[0].trim()))
}

const parsed = parseCSV(csvText)
const headers = parsed[0].map(h => h.trim())
const rows = parsed.slice(1).map(cols => {
  const obj = {}
  headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim() })
  return obj
})

console.log(`총 ${rows.length}개 백년가게 데이터 로드`)

// ─── 서울/경기 필터 ──────────────────────────────────────────
function classifyCity(addr) {
  if (!addr) return null
  if (addr.startsWith('서울')) return '서울'
  if (addr.startsWith('경기')) return '경기'
  return null
}

const targetRows = rows
  .map(r => ({ ...r, _city: classifyCity(r['업체주소']) }))
  .filter(r => r._city)

console.log(`서울: ${targetRows.filter(r => r._city === '서울').length}개`)
console.log(`경기: ${targetRows.filter(r => r._city === '경기').length}개`)
console.log(`대상 합계: ${targetRows.length}개\n`)

// ─── 네이버 지역 검색 ───────────────────────────────────────
async function searchNaver(query) {
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
    },
  })
  if (!res.ok) {
    if (res.status === 429) {
      // Rate limit → 잠시 대기 후 재시도
      await new Promise(r => setTimeout(r, 2000))
      return searchNaver(query)
    }
    return null
  }
  const data = await res.json()
  return data.items || []
}

function cleanTitle(s) {
  return (s || '').replace(/<[^>]*>/g, '').trim()
}

function parseCoord(mapx, mapy) {
  const lng = parseFloat(mapx) / 1e7
  const lat = parseFloat(mapy) / 1e7
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

// 검색 결과 중 주소 유사도가 높은 항목 선택
function pickBest(items, name, address) {
  if (!items || items.length === 0) return null
  const cityPrefix = address.split(' ').slice(0, 2).join(' ') // 예: "서울 강남구"
  // 1순위: 주소가 같은 구·시로 시작하면서 업체명 매칭
  for (const it of items) {
    const itAddr = it.roadAddress || it.address || ''
    if (itAddr.startsWith(cityPrefix.split(' ')[0]) &&
        (cleanTitle(it.title).includes(name) || name.includes(cleanTitle(it.title)))) {
      return it
    }
  }
  // 2순위: 같은 시도로 시작
  for (const it of items) {
    const itAddr = it.roadAddress || it.address || ''
    if (itAddr.startsWith(cityPrefix.split(' ')[0])) return it
  }
  // 3순위: 첫 번째 결과
  return items[0]
}

// ─── 메인 루프 ──────────────────────────────────────────────
const results = []
const failures = []

for (let i = 0; i < targetRows.length; i++) {
  const r = targetRows[i]
  const name = r['업체명']
  const addr = r['업체주소']
  const num = `[${String(i + 1).padStart(3, ' ')}/${targetRows.length}]`

  try {
    // 1차: "업체명 + 주소"로 정확 검색
    let items = await searchNaver(`${name} ${addr}`)
    let picked = pickBest(items, name, addr)
    let coord = picked ? parseCoord(picked.mapx, picked.mapy) : null

    // 2차: 업체명만으로 검색
    if (!coord) {
      items = await searchNaver(name)
      picked = pickBest(items, name, addr)
      coord = picked ? parseCoord(picked.mapx, picked.mapy) : null
    }

    if (coord) {
      results.push({
        name,
        address: addr,
        lat: coord.lat,
        lng: coord.lng,
        layer_type: 'baeknyeon',
        city: r._city,
        source_url: picked.link || null,
      })
      console.log(`${num} ✓ ${name}`)
    } else {
      failures.push({ ...r, _reason: 'no_search_result' })
      console.log(`${num} ✗ ${name} (검색 결과 없음)`)
    }
  } catch (e) {
    failures.push({ ...r, _reason: e.message })
    console.log(`${num} ✗ ${name} (에러: ${e.message})`)
  }

  // Rate limit 보호 (100ms = 초당 10건, 일 25,000건 한도에서 매우 안전)
  await new Promise(r => setTimeout(r, 120))
}

console.log(`\n✅ 성공: ${results.length}개`)
console.log(`⚠️  실패: ${failures.length}개`)

// ─── 실패 로그 저장 ─────────────────────────────────────────
if (failures.length > 0) {
  const failPath = path.join(APP_ROOT, 'supabase', 'seed-data', 'baeknyeon_failed.json')
  await fs.writeFile(failPath, JSON.stringify(failures, null, 2), 'utf8')
  console.log(`실패 케이스 → ${failPath}`)
}

// ─── Supabase 저장 ──────────────────────────────────────────
console.log('\nSupabase 저장 중...')

// 기존 백년가게 데이터 삭제 (재실행 가능)
const { error: delError } = await supabase
  .from('external_landmarks')
  .delete()
  .eq('layer_type', 'baeknyeon')

if (delError) {
  console.error('기존 데이터 삭제 실패:', delError.message)
} else {
  console.log('기존 백년가게 데이터 삭제 완료')
}

// 100개씩 배치 삽입
let inserted = 0
for (let i = 0; i < results.length; i += 100) {
  const batch = results.slice(i, i + 100)
  const { error } = await supabase.from('external_landmarks').insert(batch)
  if (error) {
    console.error(`Batch ${i}~${i + batch.length} 실패:`, error.message)
  } else {
    inserted += batch.length
    console.log(`Batch ${i + 1}~${i + batch.length}: 저장 완료`)
  }
}

console.log(`\n🎉 완료! Supabase에 ${inserted}개 저장됨`)

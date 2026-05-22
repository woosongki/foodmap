// 노션 "전국 맛집 리스트(1)" → Supabase restaurants 등록 (위시리스트)
// 사용: node scripts/seed-notion-restaurants.mjs
//
// 동작:
// 1. supabase/seed-data/notion-restaurants-1.csv 읽기
// 2. 각 행을 "업소명 + 행정동/지하철역"으로 네이버 검색 → 좌표 매칭
// 3. restaurants 테이블에 위시리스트로 INSERT
// 4. 노션 태그 → tags 테이블 (free 태그)
// 5. 메모에 출처·지하철역 정보 기록
// 6. 실패는 notion_failed.json에 저장

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
const NID = env.NAVER_CLIENT_ID
const NSC = env.NAVER_CLIENT_SECRET

// ─── CSV 파서 ────────────────────────────────────────────
function parseCSV(text) {
  const rows = []
  let cur = []
  let cell = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else inQ = false }
      else cell += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { cur.push(cell); cell = '' }
      else if (ch === '\n') { cur.push(cell); rows.push(cur); cur = []; cell = '' }
      else if (ch === '\r') {}
      else cell += ch
    }
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur) }
  return rows.filter(r => r.length > 1 || (r[0] && r[0].trim()))
}

const csvPath = path.join(APP_ROOT, 'supabase', 'seed-data', 'notion-restaurants-1.csv')
const parsed = parseCSV(await fs.readFile(csvPath, 'utf8'))
const headers = parsed[0].map(h => h.trim())
const rows = parsed.slice(1).map(cols => {
  const o = {}
  headers.forEach((h, i) => { o[h] = (cols[i] || '').trim() })
  return o
})
console.log(`총 ${rows.length}개 노션 식당 로드\n`)

// ─── 네이버 검색 ─────────────────────────────────────────
async function searchNaver(query, display = 5) {
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}`
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': NID, 'X-Naver-Client-Secret': NSC },
  })
  if (!res.ok) {
    if (res.status === 429) { await new Promise(r => setTimeout(r, 2000)); return searchNaver(query, display) }
    return null
  }
  const data = await res.json()
  return data.items || []
}
const cleanTitle = s => (s || '').replace(/<[^>]*>/g, '').trim()
const parseCoord = (mx, my) => {
  const lng = parseFloat(mx) / 1e7
  const lat = parseFloat(my) / 1e7
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

// ─── 매칭 점수 ───────────────────────────────────────────
// 노션 데이터엔 주소가 없어서 행정동/지하철역으로 점수 계산
function score(item, name, haengjeongdong, station) {
  const addr = item.roadAddress || item.address || ''
  const title = cleanTitle(item.title)
  let s = 0

  // 행정동 일치
  if (haengjeongdong && addr.includes(haengjeongdong)) s += 40

  // 지하철역 인근 (역명에서 "역" 제거하고 동네 이름으로 검색)
  if (station) {
    const stationBase = station.replace(/역$/, '')
    if (addr.includes(stationBase)) s += 30
  }

  // 업소명 매칭
  if (title === name) s += 30
  else if (title.includes(name) || name.includes(title)) s += 15

  return s
}

async function findBest(name, haengjeongdong, station) {
  // 1차: 업소명 + 행정동
  let items = await searchNaver(`${name} ${haengjeongdong}`, 10)
  let ranked = (items || []).map(it => ({ it, score: score(it, name, haengjeongdong, station) }))
    .sort((a, b) => b.score - a.score)

  if (ranked.length === 0 || ranked[0].score < 30) {
    // 2차: 업소명 + 지하철역 부근
    const stationBase = station.replace(/역$/, '')
    items = await searchNaver(`${name} ${stationBase}`, 10)
    ranked = (items || []).map(it => ({ it, score: score(it, name, haengjeongdong, station) }))
      .sort((a, b) => b.score - a.score)
  }

  if (ranked.length === 0 || ranked[0].score < 30) {
    // 3차: 업소명만
    items = await searchNaver(name, 10)
    ranked = (items || []).map(it => ({ it, score: score(it, name, haengjeongdong, station) }))
      .sort((a, b) => b.score - a.score)
  }

  if (ranked.length === 0 || ranked[0].score < 30) return null
  return ranked[0].it
}

// ─── 시도 추출 (행정동 기반은 어려우니 검색 결과의 주소로 결정) ─
function extractCity(address) {
  if (!address) return null
  const first = address.split(' ')[0]
  const CITY_MAP = {
    '서울': '서울', '서울특별시': '서울',
    '부산': '부산', '부산광역시': '부산',
    '대구': '대구', '대구광역시': '대구',
    '인천': '인천', '인천광역시': '인천',
    '광주': '광주', '광주광역시': '광주',
    '대전': '대전', '대전광역시': '대전',
    '울산': '울산', '울산광역시': '울산',
    '세종': '세종', '세종특별자치시': '세종',
    '경기': '경기', '경기도': '경기',
    '강원': '강원', '강원도': '강원', '강원특별자치도': '강원',
  }
  return CITY_MAP[first] || first
}

// ─── 메인 처리 ───────────────────────────────────────────
const toInsert = []
const failures = []

for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  const name = r['업소명']
  const dong = r['행정동']
  const station = r['지하철역']
  const tag = `[${String(i + 1).padStart(3, ' ')}/${rows.length}]`

  try {
    const found = await findBest(name, dong, station)
    if (!found) {
      failures.push({ ...r, _reason: 'no_match' })
      console.log(`${tag} ✗ ${name} (매칭 실패)`)
      continue
    }
    const coord = parseCoord(found.mapx, found.mapy)
    if (!coord) {
      failures.push({ ...r, _reason: 'no_coord', _found: cleanTitle(found.title) })
      console.log(`${tag} ✗ ${name} (좌표 없음)`)
      continue
    }

    const address = found.roadAddress || found.address || ''
    const naverTags = r['태그'].split(',').map(t => t.trim()).filter(Boolean)

    const memoLines = []
    memoLines.push('출처: 노션 전국 맛집 리스트(1)')
    if (station) memoLines.push(`지하철역: ${station}`)
    if (dong) memoLines.push(`행정동: ${dong}`)
    if (r['시그니처']) memoLines.push(`시그니처: ${r['시그니처']}`)
    if (r['특징']) memoLines.push(`특징: ${r['특징']}`)
    if (r['뉴스,소개']) memoLines.push(`뉴스: ${r['뉴스,소개']}`)
    if (r['맛 평가']) memoLines.push(`맛 평가: ${r['맛 평가']}`)

    toInsert.push({
      restaurant: {
        name,
        address,
        lat: coord.lat,
        lng: coord.lng,
        naver_url: found.link || null,
        status: 'wishlist',
        source: 'recommendation',
        recommender: '노션 리스트',
        memo: memoLines.join('\n'),
        axis_taste: false,
        axis_revisit: false,
        axis_unique: false,
      },
      tags: [
        { tag: '#노션리스트', tag_type: 'free' },
        ...naverTags.map(t => ({ tag: t.startsWith('#') ? t : `#${t}`, tag_type: 'free' })),
      ],
    })
    console.log(`${tag} ✓ ${name} → ${cleanTitle(found.title)}`)
  } catch (e) {
    failures.push({ ...r, _reason: e.message })
    console.log(`${tag} ! ${name} (에러: ${e.message})`)
  }

  await new Promise(r => setTimeout(r, 120))
}

console.log(`\n✅ 매칭 성공: ${toInsert.length}개`)
console.log(`⚠️  실패: ${failures.length}개`)

// 실패 로그
if (failures.length > 0) {
  await fs.writeFile(
    path.join(APP_ROOT, 'supabase', 'seed-data', 'notion_failed.json'),
    JSON.stringify(failures, null, 2),
    'utf8'
  )
}

// ─── Supabase 저장 ──────────────────────────────────────
// 기존 노션 리스트 출처 데이터 삭제 (재실행 가능)
console.log('\n기존 노션 리스트 출처 데이터 삭제...')
const { data: existing } = await supabase
  .from('restaurants')
  .select('id, tags(*)')
  .eq('recommender', '노션 리스트')
if (existing && existing.length > 0) {
  const ids = existing.map(r => r.id)
  await supabase.from('restaurants').delete().in('id', ids)
  console.log(`  ${ids.length}개 삭제`)
}

console.log(`\n${toInsert.length}개 새로 저장 중...`)
let saved = 0
for (const { restaurant, tags } of toInsert) {
  const { data, error } = await supabase.from('restaurants').insert([restaurant]).select()
  if (error || !data?.length) {
    console.error(`✗ ${restaurant.name}:`, error?.message)
    continue
  }
  const id = data[0].id
  if (tags.length) {
    // 중복 제거 (같은 tag 두 번 INSERT 방지)
    const uniqueTags = [...new Map(tags.map(t => [t.tag, t])).values()]
    await supabase.from('tags').insert(uniqueTags.map(t => ({ ...t, restaurant_id: id })))
  }
  saved++
}

console.log(`\n🎉 완료! ${saved}개 식당 저장 (위시리스트)`)

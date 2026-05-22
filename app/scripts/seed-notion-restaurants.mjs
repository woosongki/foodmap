// 노션 "전국 맛집 리스트" 시리즈 → Supabase restaurants 등록
// 사용: node scripts/seed-notion-restaurants.mjs
//
// 동작:
// 1. supabase/seed-data/notion-restaurants-*.csv 모두 자동 로드
// 2. 각 행을 "업소명 + 행정동/지하철역"으로 네이버 검색 → 좌표 매칭
// 3. 정책:
//    - 노션 "방문" + 맛평가 있음 → visited + axis_taste=true
//    - 노션 "방문" + 맛평가 없음 → wishlist (정보 부족)
//    - 노션 "미방문"                → wishlist
// 4. 메모에 출처·지하철역·행정동·분점·시그니처·특징·맛평가 모두 기록
// 5. tags 테이블에 노션 태그를 free 태그로 추가
// 6. 기존 노션 리스트 출처(recommender='노션 리스트') 데이터 삭제 후 재삽입

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

// ─── 모든 notion-restaurants-*.csv 자동 로드 ──────────────
const seedDir = path.join(APP_ROOT, 'supabase', 'seed-data')
const allFiles = (await fs.readdir(seedDir))
  .filter(f => /^notion-restaurants-\d+\.csv$/.test(f))
  .sort()

console.log(`발견된 노션 CSV: ${allFiles.join(', ')}\n`)

const allRows = []
for (const file of allFiles) {
  const parsed = parseCSV(await fs.readFile(path.join(seedDir, file), 'utf8'))
  const headers = parsed[0].map(h => h.trim())
  const rows = parsed.slice(1).map(cols => {
    const o = { _source: file }
    headers.forEach((h, i) => { o[h] = (cols[i] || '').trim() })
    return o
  })
  console.log(`  ${file}: ${rows.length}개`)
  allRows.push(...rows)
}
console.log(`\n총 ${allRows.length}개 행 로드\n`)

// 중복 제거 (같은 업소명 + 같은 행정동은 한 번만)
const seen = new Set()
const uniqueRows = []
for (const r of allRows) {
  const key = `${r['업소명']}::${r['행정동'] || ''}::${r['지하철역'] || ''}`
  if (seen.has(key)) continue
  seen.add(key)
  uniqueRows.push(r)
}
console.log(`중복 제거 후: ${uniqueRows.length}개\n`)

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
function score(item, name, dong, station) {
  const addr = item.roadAddress || item.address || ''
  const title = cleanTitle(item.title)
  let s = 0

  if (dong && addr.includes(dong)) s += 40

  if (station) {
    const base = station.replace(/역$/, '')
    if (addr.includes(base)) s += 30
  }

  if (title === name) s += 30
  else if (title.includes(name) || name.includes(title)) s += 15

  return s
}

async function findBest(name, dong, station) {
  // 1차: 업소명 + 행정동
  const queries = []
  if (dong) queries.push(`${name} ${dong}`)
  if (station) queries.push(`${name} ${station.replace(/역$/, '')}`)
  queries.push(name)

  let best = null
  for (const q of queries) {
    const items = await searchNaver(q, 10)
    const ranked = (items || []).map(it => ({ it, s: score(it, name, dong, station) }))
      .sort((a, b) => b.s - a.s)
    if (ranked.length && ranked[0].s >= 30 && (!best || ranked[0].s > best.s)) {
      best = ranked[0]
    }
    if (best && best.s >= 70) break // 충분히 높은 점수면 조기 종료
    await new Promise(r => setTimeout(r, 50))
  }
  return best ? best.it : null
}

// ─── 상태 결정 정책 ──────────────────────────────────────
function decideStatus(row) {
  const visitVal = (row['방문유무'] || '').trim()
  const tasteVal = (row['맛 평가'] || '').trim()
  if (visitVal === '방문' && tasteVal) {
    // 방문 + 맛평가 → 방문완료 + axis_taste
    return { status: 'visited', axis_taste: true }
  }
  return { status: 'wishlist', axis_taste: false }
}

// ─── 메인 처리 ───────────────────────────────────────────
const toInsert = []
const failures = []

for (let i = 0; i < uniqueRows.length; i++) {
  const r = uniqueRows[i]
  const name = r['업소명']
  const dong = r['행정동']
  const station = r['지하철역']
  const tag = `[${String(i + 1).padStart(4, ' ')}/${uniqueRows.length}]`

  if (!name) {
    failures.push({ ...r, _reason: 'no_name' })
    console.log(`${tag} ✗ (업소명 없음)`)
    continue
  }

  try {
    const found = await findBest(name, dong, station)
    if (!found) {
      failures.push({ ...r, _reason: 'no_match' })
      console.log(`${tag} ✗ ${name}`)
      continue
    }
    const coord = parseCoord(found.mapx, found.mapy)
    if (!coord) {
      failures.push({ ...r, _reason: 'no_coord' })
      console.log(`${tag} ✗ ${name} (좌표)`)
      continue
    }

    const address = found.roadAddress || found.address || r['주소'] || ''
    const naverTags = (r['태그'] || '').split(',').map(t => t.trim()).filter(Boolean)
    const branches = (r['분점'] || '').split(',').map(t => t.trim()).filter(Boolean)
    const { status, axis_taste } = decideStatus(r)

    const memoLines = []
    memoLines.push(`출처: ${r._source.replace('.csv', '').replace('notion-restaurants-', '노션 리스트 ')}`)
    if (station) memoLines.push(`지하철역: ${station}`)
    if (dong) memoLines.push(`행정동: ${dong}`)
    if (r['맛 평가']) memoLines.push(`맛 평가: ${r['맛 평가']}`)
    if (r['시그니처']) memoLines.push(`시그니처: ${r['시그니처']}`)
    if (r['특징']) memoLines.push(`특징: ${r['특징']}`)
    if (branches.length) memoLines.push(`분점: ${branches.join(', ')}`)
    if (r['뉴스,소개']) memoLines.push(`뉴스: ${r['뉴스,소개']}`)

    toInsert.push({
      restaurant: {
        name,
        address,
        lat: coord.lat,
        lng: coord.lng,
        naver_url: found.link || null,
        status,
        source: 'recommendation',
        recommender: '노션 리스트',
        memo: memoLines.join('\n'),
        axis_taste,
        axis_revisit: false,
        axis_unique: false,
      },
      tags: [
        { tag: '#노션리스트', tag_type: 'free' },
        ...naverTags.map(t => ({ tag: t.startsWith('#') ? t : `#${t}`, tag_type: 'free' })),
      ],
    })

    const flag = status === 'visited' ? '✓★' : '✓'
    console.log(`${tag} ${flag} ${name} → ${cleanTitle(found.title)}`)
  } catch (e) {
    failures.push({ ...r, _reason: e.message })
    console.log(`${tag} ! ${name} (${e.message})`)
  }

  await new Promise(r => setTimeout(r, 110))
}

const visitedCount = toInsert.filter(x => x.restaurant.status === 'visited').length
const wishCount = toInsert.length - visitedCount

console.log(`\n✅ 매칭 성공: ${toInsert.length}개`)
console.log(`   - 방문완료: ${visitedCount}개`)
console.log(`   - 위시리스트: ${wishCount}개`)
console.log(`⚠️  실패: ${failures.length}개`)

if (failures.length > 0) {
  await fs.writeFile(
    path.join(seedDir, 'notion_failed.json'),
    JSON.stringify(failures, null, 2),
    'utf8'
  )
}

// ─── Supabase 저장 ──────────────────────────────────────
console.log('\n기존 노션 리스트 출처 데이터 삭제...')
const { data: existing } = await supabase
  .from('restaurants')
  .select('id')
  .eq('recommender', '노션 리스트')
if (existing && existing.length > 0) {
  const ids = existing.map(r => r.id)
  // chunk delete
  for (let i = 0; i < ids.length; i += 100) {
    await supabase.from('restaurants').delete().in('id', ids.slice(i, i + 100))
  }
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
    const uniqueTags = [...new Map(tags.map(t => [t.tag, t])).values()]
    await supabase.from('tags').insert(uniqueTags.map(t => ({ ...t, restaurant_id: id })))
  }
  saved++
  if (saved % 50 === 0) console.log(`  진행: ${saved}/${toInsert.length}`)
}

console.log(`\n🎉 완료! ${saved}개 식당 저장`)
console.log(`   - 방문완료: ${visitedCount}`)
console.log(`   - 위시리스트: ${wishCount}`)

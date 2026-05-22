// 백년가게 시드 스크립트 v2
// - 카테고리 기반 자동 분류 (식당만 포함)
// - 매장명 우선 매칭, 점수 기반 선택
// - 모호한 케이스는 ambiguous.json에 격리

import fs from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_ROOT = path.join(__dirname, '..')

// ─── env 로드 ─────────────────────────────────────────────
async function loadEnv() {
  const envPath = path.join(APP_ROOT, '.env.local')
  const text = await fs.readFile(envPath, 'utf8')
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

// ─── CSV 파서 (RFC 4180) ──────────────────────────────────
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

// ─── CSV 읽기 ─────────────────────────────────────────────
const csvPath = path.join(APP_ROOT, 'supabase', 'seed-data', 'baeknyeon_utf8.csv')
const parsed = parseCSV(await fs.readFile(csvPath, 'utf8'))
const headers = parsed[0].map(h => h.trim())
const rows = parsed.slice(1).map(cols => {
  const o = {}
  headers.forEach((h, i) => { o[h] = (cols[i] || '').trim() })
  return o
})
console.log(`총 ${rows.length}개 백년가게 로드\n`)

// ─── 시도 정규화 ──────────────────────────────────────────
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
  '충북': '충북', '충청북도': '충북',
  '충남': '충남', '충청남도': '충남',
  '전북': '전북', '전라북도': '전북', '전북특별자치도': '전북',
  '전남': '전남', '전라남도': '전남',
  '경북': '경북', '경상북도': '경북',
  '경남': '경남', '경상남도': '경남',
  '제주': '제주', '제주도': '제주', '제주특별자치도': '제주',
}
function classifyCity(addr) {
  if (!addr) return null
  const first = addr.split(' ')[0]
  return CITY_MAP[first] || null
}

// ─── 카테고리 화이트/블랙리스트 ───────────────────────────
// 네이버 카테고리는 ">" 구분의 계층형. 부분 문자열 매칭으로 처리.
const RESTAURANT_KEYWORDS = [
  '한식', '중식', '일식', '양식', '분식',
  '음식점', '레스토랑', '식당',
  '카페', '디저트', '제과', '베이커리', '빵집',
  '주점', '술집', '바', '맥주', '와인', '막걸리', '소주방', '호프',
  '뷔페',
  '치킨', '닭갈비', '닭볶음', '족발', '보쌈',
  '곱창', '막창', '대창', '곰탕', '설렁탕', '추어탕', '국밥', '해장국', '갈비탕',
  '갈비', '삼겹살', '돼지고기', '소고기', '쇠고기', '한우',
  '냉면', '국수', '면옥', '칼국수', '막국수', '쌀국수', '잔치국수',
  '회', '횟집', '활어', '초밥', '스시', '돈가스', '돈까스',
  '피자', '햄버거', '샌드위치', '파스타', '스파게티',
  '도시락', '간식', '빙수', '아이스크림',
  '두부', '순두부', '청국장', '된장',
  '국수', '만두', '떡볶이', '튀김', '김밥',
  '아시안', '베트남', '태국', '인도', '멕시칸',
  '죽', '비빔밥', '쌈밥',
  '장어', '복어', '전복',
  '오리', '닭', '메기', '추어', '낙지', '주꾸미', '문어',
  '게', '꽃게', '대게',
  '곰탕집', '국밥집',
]
const NON_RESTAURANT_KEYWORDS = [
  '꽃집', '플라워', '화원', '꽃배달',
  '서점', '도서',
  '패션', '의류', '잡화', '한복',
  '미용', '이발', '미용실', '뷰티',
  '약국', '병원', '의원', '치과',
  '시계', '안경', '귀금속', '보석', '주얼리',
  '사진관', '인쇄', '문구', '필름',
  '세탁',
  '학원', '교습', '교육',
  '가구', '인테리어', '도배',
  '식품판매', '식료품', '도매', '정육점', '청과', '농산물', '수산물', '건어물',
  '편의점', '슈퍼', '마트',
  '주유소', '카센터', '정비',
  '건설', '시공', '건축',
  '유통', '상사', '무역',
  '여관', '모텔', '호텔', '게스트하우스', '펜션',
  '체육사', '운동', '헬스',
  '자동차', '타이어',
  '은행', '금융', '증권',
  '부동산', '공인중개',
  '청소', '용역',
  '제조', '공장', '공업', '산업',
  '농원', '농장',
  '목욕', '사우나', '찜질',
  '컴퓨터', 'PC', '전자',
  '꽃', '화훼',
  '제분', '제재',
  '미술', '화실', '공방',
  '신발', '구두',
  '직물', '봉제', '재단',
  '도자기', '도예',
  '약초', '한약',
]

function classifyCategory(category) {
  if (!category) return 'unknown'
  const lc = category.toLowerCase()
  // 명확한 식당 신호
  for (const kw of RESTAURANT_KEYWORDS) {
    if (category.includes(kw)) return 'restaurant'
  }
  // 명확한 비식당 신호
  for (const kw of NON_RESTAURANT_KEYWORDS) {
    if (category.includes(kw)) return 'non_restaurant'
  }
  return 'ambiguous'
}

// ─── 네이버 지역검색 ──────────────────────────────────────
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

// ─── 매장명 우선, 주소 보조 매칭 ──────────────────────────
function score(item, targetName, targetAddr) {
  const itAddr = item.roadAddress || item.address || ''
  const itTitle = cleanTitle(item.title)
  const targetTokens = targetAddr.split(' ')
  const city = targetTokens[0]
  const dist = targetTokens[1] || ''

  let s = 0
  // 시·도 일치 (정규화 포함)
  const normTargetCity = CITY_MAP[city] || city
  const itFirstToken = itAddr.split(' ')[0]
  const normItCity = CITY_MAP[itFirstToken] || itFirstToken
  if (normTargetCity === normItCity) s += 50
  else if (itAddr.startsWith(city)) s += 40 // 약한 매칭

  // 시·군·구 일치
  if (dist && itAddr.includes(dist)) s += 30

  // 이름 매칭
  const exactName = itTitle === targetName
  const includes = itTitle.includes(targetName) || targetName.includes(itTitle)
  if (exactName) s += 30
  else if (includes) s += 15

  return s
}

async function findBest(name, addr) {
  // 1차: 매장명으로만 검색 (후보 10개)
  let items = await searchNaver(name, 10)
  if (!items || items.length === 0) {
    // 2차: 매장명 + 시도
    const city = (addr.split(' ')[0] || '')
    items = await searchNaver(`${name} ${city}`, 10)
  }
  if (!items || items.length === 0) {
    // 3차: 매장명 + 주소
    items = await searchNaver(`${name} ${addr}`, 10)
  }
  if (!items || items.length === 0) return null

  // 후보 점수 매기기
  const ranked = items
    .map(it => ({ it, score: score(it, name, addr), title: cleanTitle(it.title) }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  // 최소 점수 미만이면 매칭 실패로 간주 (오매칭 방지)
  if (best.score < 50) return null
  return best.it
}

// ─── 메인 처리 ────────────────────────────────────────────
const targetRows = rows
  .map(r => ({ ...r, _city: classifyCity(r['업체주소']) }))
  .filter(r => r._city)

const cityDist = {}
for (const r of targetRows) cityDist[r._city] = (cityDist[r._city] || 0) + 1
console.log('시도 분포:', Object.entries(cityDist).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}:${n}`).join(', '))
console.log(`대상 합계: ${targetRows.length}개\n`)

const restaurants = []   // 자동 결정: 식당 → DB INSERT
const nonRestaurants = [] // 자동 결정: 비식당 → 제외
const ambiguous = []     // 모호: 사용자 확인 필요
const notFound = []      // 검색 실패

let n = 0
for (const r of targetRows) {
  n++
  const name = r['업체명']
  const addr = r['업체주소']
  const tag = `[${String(n).padStart(4, ' ')}/${targetRows.length}]`

  try {
    const found = await findBest(name, addr)
    if (!found) {
      notFound.push({ ...r, _reason: 'no_match' })
      console.log(`${tag} ✗ ${name} (매칭 실패)`)
    } else {
      const coord = parseCoord(found.mapx, found.mapy)
      if (!coord) {
        notFound.push({ ...r, _reason: 'no_coord', _found: cleanTitle(found.title) })
        console.log(`${tag} ✗ ${name} (좌표 없음)`)
      } else {
        const cat = found.category || ''
        const verdict = classifyCategory(cat)
        const entry = {
          name,
          address: addr,
          lat: coord.lat,
          lng: coord.lng,
          layer_type: 'baeknyeon',
          city: r._city,
          source_url: found.link || null,
          _category: cat,
          _matched_name: cleanTitle(found.title),
        }
        if (verdict === 'restaurant') {
          restaurants.push(entry)
          console.log(`${tag} ✓ ${name} [식당: ${cat}]`)
        } else if (verdict === 'non_restaurant') {
          nonRestaurants.push(entry)
          console.log(`${tag} ✗ ${name} [비식당: ${cat}]`)
        } else {
          ambiguous.push(entry)
          console.log(`${tag} ? ${name} [모호: ${cat || '카테고리 없음'}]`)
        }
      }
    }
  } catch (e) {
    notFound.push({ ...r, _reason: e.message })
    console.log(`${tag} ! ${name} (에러: ${e.message})`)
  }

  await new Promise(r => setTimeout(r, 110))
}

console.log('\n─── 자동 분류 결과 ───')
console.log(`✅ 식당 (자동 포함)     : ${restaurants.length}개`)
console.log(`❌ 비식당 (자동 제외)   : ${nonRestaurants.length}개`)
console.log(`❓ 모호 (사용자 확인)   : ${ambiguous.length}개`)
console.log(`⚠️  매칭 실패           : ${notFound.length}개`)

// ─── 결과 파일 저장 ──────────────────────────────────────
const dataDir = path.join(APP_ROOT, 'supabase', 'seed-data')
await fs.writeFile(path.join(dataDir, 'baeknyeon_restaurants.json'), JSON.stringify(restaurants, null, 2), 'utf8')
await fs.writeFile(path.join(dataDir, 'baeknyeon_non_restaurants.json'), JSON.stringify(nonRestaurants, null, 2), 'utf8')
await fs.writeFile(path.join(dataDir, 'baeknyeon_ambiguous.json'), JSON.stringify(ambiguous, null, 2), 'utf8')
await fs.writeFile(path.join(dataDir, 'baeknyeon_not_found.json'), JSON.stringify(notFound, null, 2), 'utf8')
console.log(`\n결과 파일 저장됨: ${dataDir}`)

// ─── Supabase: 자동 식당만 우선 저장 ──────────────────────
console.log('\nSupabase에 자동 식당 분류만 우선 저장 (모호 케이스는 사용자 확인 후 추가 예정)...')
await supabase.from('external_landmarks').delete().eq('layer_type', 'baeknyeon')

let inserted = 0
for (let i = 0; i < restaurants.length; i += 100) {
  const batch = restaurants.slice(i, i + 100).map(r => {
    const { _category, _matched_name, ...rest } = r
    return rest
  })
  const { error } = await supabase.from('external_landmarks').insert(batch)
  if (error) console.error(`Batch ${i + 1}~${i + batch.length} 실패:`, error.message)
  else { inserted += batch.length; console.log(`Batch ${i + 1}~${i + batch.length}: 저장`) }
}
console.log(`\n🎉 1단계 완료: 자동 식당 ${inserted}개 저장. 모호 ${ambiguous.length}개는 사용자 확인 대기.`)

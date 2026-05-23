import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import NaverMap from './components/NaverMap'
import BottomSheet from './components/BottomSheet'
import LandmarkSheet from './components/LandmarkSheet'
import AddRestaurant from './components/AddRestaurant'
import BulkAdd from './components/BulkAdd'
import FilterBar from './components/FilterBar'
import AuthModal from './components/AuthModal'

const NEARBY_KM = 2

// ─── Supabase egress 절감 ──────────────────────────────────
// 1. restaurants 캐싱: localStorage + 30분 TTL
// 2. landmarks: 정적 JSON (/baeknyeon.json)에서 가져옴
// 3. select 최적화: 지도용 최소 필드만, photos/memo는 핀 클릭 시 lazy load
const CACHE_KEY = 'foodmap_restaurants_v1'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30분

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) return null
    return data
  } catch { return null }
}
function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data })) } catch {}
}
function invalidateCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function App() {
  const [restaurants, setRestaurants] = useState([])
  const [landmarks, setLandmarks] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedLandmark, setSelectedLandmark] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [filters, setFilters] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [showNearby, setShowNearby] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [layerBaeknyeon, setLayerBaeknyeon] = useState(false)
  const [layerReview, setLayerReview] = useState(false)

  useEffect(() => { fetchRestaurants(); fetchLandmarks() }, [])

  // restaurants: 캐시 우선 → 미스 시 Supabase. 지도용 필드만 (memo/photos 제외)
  const fetchRestaurants = async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = readCache()
      if (cached) { setRestaurants(cached); return }
    }
    const { data } = await supabase
      .from('restaurants')
      .select('id, name, address, lat, lng, status, naver_url, source, recommender, axis_taste, axis_revisit, axis_unique, tags(tag, tag_type)')
      .order('created_at', { ascending: false })
    if (data) {
      setRestaurants(data)
      writeCache(data)
    }
  }

  // landmarks: 정적 JSON (Vercel CDN). Supabase egress 안 씀
  const fetchLandmarks = async () => {
    try {
      const res = await fetch('/baeknyeon.json')
      if (res.ok) {
        const data = await res.json()
        setLandmarks(data)
      }
    } catch (e) {
      console.error('백년가게 데이터 로드 실패:', e)
    }
  }

  // 핀 클릭 시 photos·memo lazy load (캐시 안 됨, 매번 새로)
  const handleSelectRestaurant = async (r) => {
    setSelected(r)  // 1차: 기본 정보로 즉시 표시
    if (r._detailLoaded) return  // 이미 로드된 경우

    // 2차: photos + memo만 추가 fetch
    const { data } = await supabase
      .from('restaurants')
      .select('memo, photos(*)')
      .eq('id', r.id)
      .single()

    if (data) {
      const enriched = { ...r, memo: data.memo, photos: data.photos, _detailLoaded: true }
      setSelected(enriched)
      // 현재 restaurants 배열에도 반영 (다음에 클릭 시 캐시)
      setRestaurants(prev => prev.map(x => x.id === r.id ? enriched : x))
    }
  }

  const handleAddRestaurant = async (payload) => {
    const { _tags, _photos, ...restaurantData } = payload
    const { data, error } = await supabase.from('restaurants').insert([restaurantData]).select()
    if (error || !data?.length) { alert('저장 중 오류가 발생했습니다.'); return }
    const id = data[0].id
    if (_tags?.length) await supabase.from('tags').insert(_tags.map(t => ({ ...t, restaurant_id: id })))
    if (_photos?.length) await supabase.from('photos').insert(_photos.map(p => ({ ...p, restaurant_id: id })))
    invalidateCache()
    await fetchRestaurants(true)
    setShowAdd(false)
  }

  const handleBulkAdd = async (payloads) => {
    let success = 0
    let failed = 0
    for (const p of payloads) {
      const { _tags, _photos, ...restaurantData } = p
      const { data, error } = await supabase.from('restaurants').insert([restaurantData]).select()
      if (error || !data?.length) { failed++; continue }
      const id = data[0].id
      if (_tags?.length) await supabase.from('tags').insert(_tags.map(t => ({ ...t, restaurant_id: id })))
      success++
    }
    alert(`저장 완료\n✅ 성공: ${success}\n${failed ? `❌ 실패: ${failed}` : ''}`)
    invalidateCache()
    await fetchRestaurants(true)
    setShowBulkAdd(false)
  }

  const handleDeleteRestaurant = async (id) => {
    await supabase.from('restaurants').delete().eq('id', id)
    setSelected(null)
    invalidateCache()
    await fetchRestaurants(true)
  }

  const handleUpdateRestaurant = useCallback(async (id, updates) => {
    await supabase.from('restaurants').update(updates).eq('id', id)
    invalidateCache()
    await fetchRestaurants(true)
    setSelected(prev => prev?.id === id ? { ...prev, ...updates } : prev)
  }, [])

  const handleNearby = () => {
    if (showNearby) {
      setShowNearby(false)
      setUserLocation(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setShowNearby(true) },
      () => alert('위치 권한을 허용해주세요.')
    )
  }

  const visibleRestaurants = restaurants.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (filters.length > 0) {
      const rTags = (r.tags || []).map(t => t.tag)
      if (!filters.every(f => rTags.includes(f))) return false
    }
    if (showNearby && userLocation) {
      return haversineKm(userLocation.lat, userLocation.lng, r.lat, r.lng) <= NEARBY_KM
    }
    return true
  })

  const visibleLandmarks = landmarks.filter(l => {
    // 토글에 따라 레이어 표시
    if (l.layer_type === 'baeknyeon' && !layerBaeknyeon) return false
    if (l.layer_type === 'review' && !layerReview) return false
    if (showNearby && userLocation) {
      return haversineKm(userLocation.lat, userLocation.lng, l.lat, l.lng) <= NEARBY_KM
    }
    return true
  })

  const hasBottomSheet = Boolean(selected) || Boolean(selectedLandmark)
  const addButtonBottom = hasBottomSheet ? 'calc(65vh + 16px)' : '80px'

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      <FilterBar
        filters={filters} setFilters={setFilters}
        statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        showNearby={showNearby} onNearby={handleNearby}
        layerBaeknyeon={layerBaeknyeon} setLayerBaeknyeon={setLayerBaeknyeon}
        layerReview={layerReview} setLayerReview={setLayerReview}
      />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, paddingTop: '96px' }}>
        <NaverMap
          restaurants={visibleRestaurants}
          landmarks={visibleLandmarks}
          onSelectRestaurant={r => { setSelectedLandmark(null); handleSelectRestaurant(r) }}
          onSelectLandmark={l => { setSelected(null); setSelectedLandmark(l) }}
          userLocation={userLocation}
        />
      </div>

      {selected && (
        <BottomSheet
          restaurant={selected}
          onClose={() => setSelected(null)}
          isAuthenticated={isAuthenticated}
          onDelete={handleDeleteRestaurant}
          onUpdate={handleUpdateRestaurant}
          onEditRequest={() => setShowAuth(true)}
        />
      )}

      {selectedLandmark && (
        <LandmarkSheet
          landmark={selectedLandmark}
          onClose={() => setSelectedLandmark(null)}
        />
      )}

      {/* 편집 모드 진입 버튼 */}
      {!isAuthenticated && (
        <button
          onClick={() => setShowAuth(true)}
          style={{
            position: 'absolute', bottom: '20px', right: '16px',
            padding: '11px 18px', borderRadius: '9999px', border: 'none',
            background: 'white', fontSize: '13px', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 100, color: '#6B7280',
            fontWeight: '500',
          }}
        >🔒 편집 모드</button>
      )}

      {/* + 버튼 + 일괄 등록 버튼 (편집 모드 시) */}
      {isAuthenticated && (
        <div style={{
          position: 'absolute', bottom: addButtonBottom, right: '18px',
          display: 'flex', flexDirection: 'column', gap: '12px',
          zIndex: 100, transition: 'bottom 0.3s ease', alignItems: 'flex-end',
        }}>
          <button
            onClick={() => setShowBulkAdd(true)}
            title="여러 곳 한번에 등록"
            style={{
              width: '48px', height: '48px', borderRadius: '50%',
              background: 'white', color: '#FF6B35', border: 'none',
              fontSize: '20px', lineHeight: '1', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            }}
          >📋</button>
          <button
            onClick={() => setShowAdd(true)}
            title="한 곳 등록"
            style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: '#FF6B35', color: 'white', border: 'none',
              fontSize: '30px', lineHeight: '1', cursor: 'pointer',
              boxShadow: '0 6px 20px rgba(255,107,53,0.40)',
              fontWeight: '300',
            }}
          >+</button>
        </div>
      )}

      {/* 인증 모달 */}
      {showAuth && (
        <AuthModal
          onSuccess={() => { setIsAuthenticated(true); setShowAuth(false) }}
          onClose={() => setShowAuth(false)}
        />
      )}

      {/* 식당 등록 모달 */}
      {showAdd && (
        <AddRestaurant
          onSave={handleAddRestaurant}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* 일괄 등록 모달 */}
      {showBulkAdd && (
        <BulkAdd
          onSave={handleBulkAdd}
          onClose={() => setShowBulkAdd(false)}
        />
      )}
    </div>
  )
}

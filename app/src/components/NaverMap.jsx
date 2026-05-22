import { useEffect, useRef, useState } from 'react'

const VISITED_COLOR = '#FF385C'
const WISHLIST_COLOR = '#94A3B8'
const LAYER_STYLE = {
  baeknyeon: { color: '#D97706', icon: '🏛️', bg: '#FEF3C7' },
  review: { color: '#059669', icon: '⭐', bg: '#ECFDF5' },
}

function isSdkReady() {
  return !!(window.naver && window.naver.maps && window.naver.maps.Marker && window.naver.maps.LatLng)
}

// 내 맛집 핀 (물방울형)
function restaurantMarkerIcon(status, size = 36) {
  const color = status === 'visited' ? VISITED_COLOR : WISHLIST_COLOR
  return {
    content: [
      `<div style="`,
      `width:${size}px;height:${size}px;`,
      `background:${color};`,
      `border-radius:50% 50% 50% 0;`,
      `transform:rotate(-45deg);`,
      `box-shadow:0 2px 6px rgba(0,0,0,0.25);`,
      `border:2px solid white;`,
      `cursor:pointer;`,
      `"></div>`,
    ].join(''),
    anchor: new window.naver.maps.Point(size / 2, size),
  }
}

// 외부 레이어 핀 (원형 + 이모지)
function landmarkMarkerIcon(layerType, size = 30) {
  const s = LAYER_STYLE[layerType] || LAYER_STYLE.baeknyeon
  return {
    content: [
      `<div style="`,
      `width:${size}px;height:${size}px;`,
      `background:${s.bg};`,
      `border:2px solid ${s.color};`,
      `border-radius:50%;`,
      `display:flex;align-items:center;justify-content:center;`,
      `font-size:${Math.floor(size * 0.5)}px;`,
      `box-shadow:0 1px 4px rgba(0,0,0,0.2);`,
      `cursor:pointer;`,
      `">${s.icon}</div>`,
    ].join(''),
    anchor: new window.naver.maps.Point(size / 2, size / 2),
  }
}

export default function NaverMap({
  restaurants, landmarks,
  onSelectRestaurant, onSelectLandmark,
  userLocation,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const restaurantMarkersRef = useRef([])
  const landmarkMarkersRef = useRef([])
  const userMarkerRef = useRef(null)
  const [sdkReady, setSdkReady] = useState(isSdkReady())

  // SDK 로드 대기
  useEffect(() => {
    if (sdkReady) return
    const timer = setInterval(() => {
      if (isSdkReady()) {
        setSdkReady(true)
        clearInterval(timer)
      }
    }, 150)
    const giveUp = setTimeout(() => clearInterval(timer), 30000)
    return () => { clearInterval(timer); clearTimeout(giveUp) }
  }, [sdkReady])

  // 지도 초기화
  useEffect(() => {
    if (!sdkReady || mapRef.current) return
    mapRef.current = new window.naver.maps.Map(containerRef.current, {
      center: new window.naver.maps.LatLng(37.5665, 126.9780),
      zoom: 13,
      mapTypeControl: false,
      scaleControl: false,
      logoControl: true,
      mapDataControl: false,
      zoomControl: false,
    })
  }, [sdkReady])

  // 식당 마커
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return

    restaurantMarkersRef.current.forEach(m => m.setMap(null))
    restaurantMarkersRef.current = []

    restaurants.forEach(r => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(r.lat, r.lng),
        map: mapRef.current,
        icon: restaurantMarkerIcon(r.status),
        title: r.name,
        zIndex: 100,
      })
      window.naver.maps.Event.addListener(marker, 'click', () => {
        onSelectRestaurant(r)
        mapRef.current.panTo(new window.naver.maps.LatLng(r.lat, r.lng))
      })
      restaurantMarkersRef.current.push(marker)
    })
  }, [restaurants, onSelectRestaurant, sdkReady])

  // 외부 레이어 마커 (백년가게, 리뷰)
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return

    landmarkMarkersRef.current.forEach(m => m.setMap(null))
    landmarkMarkersRef.current = []

    landmarks.forEach(l => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(l.lat, l.lng),
        map: mapRef.current,
        icon: landmarkMarkerIcon(l.layer_type),
        title: l.name,
        zIndex: 50, // 내 맛집보다 뒤
      })
      window.naver.maps.Event.addListener(marker, 'click', () => {
        onSelectLandmark(l)
        mapRef.current.panTo(new window.naver.maps.LatLng(l.lat, l.lng))
      })
      landmarkMarkersRef.current.push(marker)
    })
  }, [landmarks, onSelectLandmark, sdkReady])

  // 현재 위치 마커
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
      userMarkerRef.current = null
    }

    if (userLocation) {
      userMarkerRef.current = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(userLocation.lat, userLocation.lng),
        map: mapRef.current,
        icon: {
          content: '<div style="width:14px;height:14px;background:#3B82F6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 2px #3B82F6;"></div>',
          anchor: new window.naver.maps.Point(7, 7),
        },
        zIndex: 200,
      })
      mapRef.current.panTo(new window.naver.maps.LatLng(userLocation.lat, userLocation.lng))
    }
  }, [userLocation, sdkReady])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!sdkReady && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          background: '#F3F4F6', color: '#6B7280', fontSize: '14px',
        }}>
          지도를 불러오는 중...
        </div>
      )}
    </div>
  )
}

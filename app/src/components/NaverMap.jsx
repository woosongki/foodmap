import { useEffect, useRef, useState } from 'react'

const VISITED_COLOR = '#FF6B35'
const WISHLIST_COLOR = '#94A3B8'
const LAYER_STYLE = {
  baeknyeon: { color: '#F59E0B', icon: '🏛️', bg: '#FEF3C7' },
  review: { color: '#10B981', icon: '⭐', bg: '#ECFDF5' },
}

function isSdkReady() {
  return !!(
    window.naver &&
    window.naver.maps &&
    window.naver.maps.Marker &&
    window.naver.maps.LatLng &&
    window.MarkerClustering
  )
}

// 내 맛집 핀
function restaurantMarkerIcon(status, size = 36) {
  const color = status === 'visited' ? VISITED_COLOR : WISHLIST_COLOR
  return {
    content: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.25);border:2px solid white;cursor:pointer;"></div>`,
    anchor: new window.naver.maps.Point(size / 2, size),
  }
}

// 외부 레이어 핀
function landmarkMarkerIcon(layerType, size = 30) {
  const s = LAYER_STYLE[layerType] || LAYER_STYLE.baeknyeon
  return {
    content: `<div style="width:${size}px;height:${size}px;background:${s.bg};border:2px solid ${s.color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size * 0.5)}px;box-shadow:0 1px 4px rgba(0,0,0,0.2);cursor:pointer;">${s.icon}</div>`,
    anchor: new window.naver.maps.Point(size / 2, size / 2),
  }
}

// 클러스터 아이콘 (크기·색상별)
function clusterIcon(color, borderColor, size) {
  return {
    content: `<div style="cursor:pointer;width:${size}px;height:${size}px;line-height:${size}px;font-size:13px;color:white;font-weight:700;text-align:center;background:${color};border:3px solid ${borderColor};border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
    size: new window.naver.maps.Size(size, size),
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
  const restaurantClustererRef = useRef(null)
  const landmarkClustererRef = useRef(null)
  const userMarkerRef = useRef(null)
  const [sdkReady, setSdkReady] = useState(isSdkReady())

  // SDK 로드 대기 (지도 SDK + MarkerClustering)
  useEffect(() => {
    if (sdkReady) return
    const timer = setInterval(() => {
      if (isSdkReady()) { setSdkReady(true); clearInterval(timer) }
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

  // 식당 클러스터러 (내 맛집)
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return

    // 기존 클러스터러 제거
    if (restaurantClustererRef.current) {
      restaurantClustererRef.current.setMap(null)
      restaurantClustererRef.current = null
    }

    // 새 마커 생성
    const markers = restaurants.map(r => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(r.lat, r.lng),
        icon: restaurantMarkerIcon(r.status),
        title: r.name,
      })
      window.naver.maps.Event.addListener(marker, 'click', () => {
        onSelectRestaurant(r)
        mapRef.current.panTo(new window.naver.maps.LatLng(r.lat, r.lng))
      })
      return marker
    })

    // 클러스터러 생성
    restaurantClustererRef.current = new window.MarkerClustering({
      minClusterSize: 2,
      maxZoom: 14,
      map: mapRef.current,
      markers,
      disableClickZoom: false,
      gridSize: 100,
      icons: [
        clusterIcon('#FF6B35', 'white', 36),
        clusterIcon('#FF6B35', 'white', 42),
        clusterIcon('#E85A2C', 'white', 48),
        clusterIcon('#C44820', 'white', 54),
        clusterIcon('#9C3818', 'white', 60),
      ],
      indexGenerator: [10, 30, 80, 200, 500],
      stylingFunction: (clusterMarker, count) => {
        const el = clusterMarker.getElement().querySelector('div')
        if (el) el.innerText = String(count)
      },
    })
  }, [restaurants, onSelectRestaurant, sdkReady])

  // 외부 레이어 클러스터러 (백년가게 등)
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return

    if (landmarkClustererRef.current) {
      landmarkClustererRef.current.setMap(null)
      landmarkClustererRef.current = null
    }

    const markers = landmarks.map(l => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(l.lat, l.lng),
        icon: landmarkMarkerIcon(l.layer_type),
        title: l.name,
      })
      window.naver.maps.Event.addListener(marker, 'click', () => {
        onSelectLandmark(l)
        mapRef.current.panTo(new window.naver.maps.LatLng(l.lat, l.lng))
      })
      return marker
    })

    landmarkClustererRef.current = new window.MarkerClustering({
      minClusterSize: 2,
      maxZoom: 14,
      map: mapRef.current,
      markers,
      disableClickZoom: false,
      gridSize: 100,
      icons: [
        clusterIcon('#F59E0B', 'white', 32),
        clusterIcon('#F59E0B', 'white', 38),
        clusterIcon('#D97706', 'white', 44),
        clusterIcon('#B45309', 'white', 50),
        clusterIcon('#92400E', 'white', 56),
      ],
      indexGenerator: [10, 30, 80, 200, 500],
      stylingFunction: (clusterMarker, count) => {
        const el = clusterMarker.getElement().querySelector('div')
        if (el) el.innerText = String(count)
      },
    })
  }, [landmarks, onSelectLandmark, sdkReady])

  // 사용자 위치 마커
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

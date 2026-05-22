import { useEffect, useRef } from 'react'

const VISITED_COLOR = '#FF385C'
const WISHLIST_COLOR = '#94A3B8'

function markerIcon(status, size = 36) {
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

export default function NaverMap({ restaurants, onSelectRestaurant, userLocation }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const userMarkerRef = useRef(null)

  // 지도 초기화 (한 번만)
  useEffect(() => {
    const init = () => {
      if (!window.naver || mapRef.current) return
      mapRef.current = new window.naver.maps.Map(containerRef.current, {
        center: new window.naver.maps.LatLng(37.5665, 126.9780),
        zoom: 13,
        mapTypeControl: false,
        scaleControl: false,
        logoControl: true,
        mapDataControl: false,
        zoomControl: false,
      })
    }

    // SDK 로드 대기
    if (window.naver) {
      init()
    } else {
      const timer = setInterval(() => {
        if (window.naver) { clearInterval(timer); init() }
      }, 100)
      return () => clearInterval(timer)
    }
  }, [])

  // 식당 마커 갱신
  useEffect(() => {
    if (!mapRef.current) return

    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    restaurants.forEach(r => {
      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(r.lat, r.lng),
        map: mapRef.current,
        icon: markerIcon(r.status),
        title: r.name,
      })
      window.naver.maps.Event.addListener(marker, 'click', () => {
        onSelectRestaurant(r)
        mapRef.current.panTo(new window.naver.maps.LatLng(r.lat, r.lng))
      })
      markersRef.current.push(marker)
    })
  }, [restaurants, onSelectRestaurant])

  // 현재 위치 마커
  useEffect(() => {
    if (!mapRef.current) return

    if (userMarkerRef.current) { userMarkerRef.current.setMap(null); userMarkerRef.current = null }

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
  }, [userLocation])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// 외부 레이어(백년가게·리뷰1만+) 핀의 상세 시트
// 내 맛집과는 다른 UI: 단순 정보 + 네이버 지도 링크

const LAYER_META = {
  baeknyeon: { icon: '🏛️', label: '백년가게', color: '#D97706', bg: '#FEF3C7' },
  review: { icon: '⭐', label: '리뷰 1만+', color: '#059669', bg: '#ECFDF5' },
}

export default function LandmarkSheet({ landmark, onClose }) {
  const meta = LAYER_META[landmark.layer_type] || { icon: '📍', label: '외부', color: '#6B7280', bg: '#F3F4F6' }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'white', borderRadius: '20px 20px 0 0',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
      maxHeight: '50vh', overflowY: 'auto',
      zIndex: 200, padding: '0 16px 20px',
    }}>
      <div style={{ position: 'sticky', top: 0, background: 'white', paddingTop: '10px', paddingBottom: '8px' }}>
        <div style={{ width: '40px', height: '4px', background: '#E5E7EB', borderRadius: '2px', margin: '0 auto' }} />
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <div style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', background: meta.bg, color: meta.color, marginBottom: '6px' }}>
            {meta.icon} {meta.label}
          </div>
          <h2 style={{ fontSize: '19px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
            {landmark.name}
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>{landmark.address}</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9CA3AF', padding: '2px' }}>✕</button>
      </div>

      {/* 출처 안내 */}
      <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '14px', lineHeight: '1.5' }}>
        {landmark.layer_type === 'baeknyeon'
          ? '중소벤처기업부 · 소상공인시장진흥공단이 지정한 백년가게입니다. (등록일 기준)'
          : '외부 출처 기반의 참고용 정보입니다.'}
      </p>

      {/* 네이버 지도 링크 */}
      {landmark.source_url && (
        <a href={landmark.source_url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '11px', borderRadius: '10px', marginBottom: '8px',
            background: '#03C75A', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: '600',
          }}>
          네이버 지도에서 보기
        </a>
      )}

      <a href={`https://map.naver.com/v5/search/${encodeURIComponent(landmark.name + ' ' + landmark.address)}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: 'block', textAlign: 'center', padding: '10px', borderRadius: '10px',
          border: '1px solid #E5E7EB', color: '#374151', textDecoration: 'none', fontSize: '13px',
        }}>
        네이버 지도에서 검색
      </a>
    </div>
  )
}

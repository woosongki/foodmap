const LAYER_META = {
  baeknyeon: { icon: '🏛️', label: '백년가게', color: '#D97706', bg: '#FEF3C7' },
  review: { icon: '⭐', label: '리뷰 1만+', color: '#10B981', bg: '#ECFDF5' },
}

export default function LandmarkSheet({ landmark, onClose }) {
  const meta = LAYER_META[landmark.layer_type] || { icon: '📍', label: '외부', color: '#6B7280', bg: '#F3F4F6' }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'white', borderRadius: '24px 24px 0 0',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.10)',
      maxHeight: '50vh', overflowY: 'auto',
      zIndex: 200, padding: '0 18px 22px',
    }}>
      <div style={{ position: 'sticky', top: 0, background: 'white', paddingTop: '10px', paddingBottom: '10px', zIndex: 1 }}>
        <div style={{ width: '42px', height: '4px', background: '#E5E7EB', borderRadius: '2px', margin: '0 auto' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', background: meta.bg, color: meta.color, marginBottom: '8px' }}>
            {meta.icon} {meta.label}
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', marginBottom: '4px', letterSpacing: '-0.3px' }}>
            {landmark.name}
          </h2>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>{landmark.address}</p>
        </div>
        <button onClick={onClose}
          style={{
            background: '#F9FAFB', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px', cursor: 'pointer', color: '#6B7280',
            fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>✕</button>
      </div>

      <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '14px', lineHeight: '1.5' }}>
        {landmark.layer_type === 'baeknyeon'
          ? '중소벤처기업부 · 소상공인시장진흥공단이 지정한 백년가게입니다.'
          : '외부 출처 기반의 참고용 정보입니다.'}
      </p>

      {landmark.source_url && (
        <a href={landmark.source_url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '13px', borderRadius: '14px', marginBottom: '8px',
            background: '#03C75A', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(3,199,90,0.20)',
          }}>
          네이버 지도에서 보기
        </a>
      )}

      <a href={`https://map.naver.com/v5/search/${encodeURIComponent(landmark.name + ' ' + landmark.address)}`}
        target="_blank" rel="noopener noreferrer"
        style={{
          display: 'block', textAlign: 'center', padding: '11px', borderRadius: '14px',
          border: '1px solid #F3F4F6', color: '#6B7280', textDecoration: 'none', fontSize: '13px',
        }}>
        네이버 지도에서 검색
      </a>
    </div>
  )
}

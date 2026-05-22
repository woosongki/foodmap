const LEVEL_TAGS = ['#재방문', '#감동', '#일차']

const chip = (active, accent = '#FF385C', bg = '#FFF1F3') => ({
  padding: '5px 12px',
  borderRadius: '16px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: active ? '600' : '400',
  background: active ? accent : bg,
  color: active ? 'white' : accent,
  whiteSpace: 'nowrap',
  flexShrink: 0,
})

export default function FilterBar({
  filters, setFilters,
  statusFilter, setStatusFilter,
  showNearby, onNearby,
  layerBaeknyeon, setLayerBaeknyeon,
  layerReview, setLayerReview,
}) {
  const toggleTag = tag =>
    setFilters(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
      padding: '10px 12px 8px',
    }}>
      {/* 상태 필터 + 내 주변 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
        {[
          { val: 'all', label: '전체' },
          { val: 'visited', label: '방문완료' },
          { val: 'wishlist', label: '위시리스트' },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            style={chip(statusFilter === val, '#FF385C', '#F3F4F6')}
          >{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={onNearby}
          style={chip(showNearby, '#3B82F6', '#EFF6FF')}
        >📍 내 주변</button>
      </div>

      {/* 태그 필터 + 기본 레이어 */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {LEVEL_TAGS.map(tag => (
          <button key={tag} onClick={() => toggleTag(tag)} style={chip(filters.includes(tag))}>
            {tag}
          </button>
        ))}
        <div style={{ width: '1px', background: '#E5E7EB', margin: '0 4px', flexShrink: 0 }} />
        <button
          onClick={() => setLayerBaeknyeon(v => !v)}
          style={chip(layerBaeknyeon, '#D97706', '#FEF3C7')}
        >🏛️ 백년</button>
        <button
          onClick={() => setLayerReview(v => !v)}
          style={chip(layerReview, '#059669', '#ECFDF5')}
        >⭐ 리뷰</button>
      </div>
    </div>
  )
}

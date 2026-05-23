const LEVEL_TAGS = ['#재방문', '#감동', '#일차']

const chip = (active, accent = '#FF6B35', softBg = '#FFF5EE') => ({
  padding: '7px 14px',
  borderRadius: '9999px',
  border: active ? 'none' : '1px solid #F3F4F6',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: active ? '600' : '500',
  background: active ? accent : softBg,
  color: active ? 'white' : accent,
  whiteSpace: 'nowrap',
  flexShrink: 0,
  letterSpacing: '-0.1px',
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
      background: 'white',
      boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
      padding: '12px 14px 10px',
      borderBottom: '1px solid #F9FAFB',
    }}>
      {/* 상태 필터 + 내 주변 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', alignItems: 'center' }}>
        {[
          { val: 'all', label: '전체' },
          { val: 'visited', label: '방문' },
          { val: 'wishlist', label: '위시' },
        ].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setStatusFilter(val)}
            style={chip(statusFilter === val, '#FF6B35', '#F9FAFB')}
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
        <div style={{ width: '1px', background: '#F3F4F6', margin: '0 4px', flexShrink: 0 }} />
        <button
          onClick={() => setLayerBaeknyeon(v => !v)}
          style={chip(layerBaeknyeon, '#F59E0B', '#FFFBEB')}
        >🏛️ 백년</button>
        <button
          onClick={() => setLayerReview(v => !v)}
          style={chip(layerReview, '#10B981', '#ECFDF5')}
        >⭐ 리뷰</button>
      </div>
    </div>
  )
}

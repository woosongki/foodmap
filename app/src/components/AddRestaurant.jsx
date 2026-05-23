import { useState } from 'react'

const LEVEL_TAGS = ['#재방문', '#감동', '#일차']
const AXIS_LIST = [
  { key: 'axis_taste', label: '맛', desc: '음식 자체의 완성도가 분명히 다른 곳' },
  { key: 'axis_revisit', label: '재방문 의사', desc: '"또 가야지"라는 마음이 드는 곳' },
  { key: 'axis_unique', label: '희소성·특별함', desc: '흔하지 않은 메뉴·공간·경험' },
]

const label = text => ({
  fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '8px',
})
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none',
}

export default function AddRestaurant({ onSave, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [step, setStep] = useState('search')

  const [form, setForm] = useState({
    status: 'visited',
    source: 'self',
    recommender: '',
    memo: '',
    axis_taste: false,
    axis_revisit: false,
    axis_unique: false,
    levelTags: [],
    freeTags: '',
    photos: ['', '', ''],
  })

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`)
      const data = await res.json()
      setResults(data.items || [])
    } catch {
      alert('검색 중 오류가 발생했습니다. (개발 중에는 vercel dev로 실행하세요)')
    } finally {
      setLoading(false)
    }
  }

  const pick = item => {
    const name = item.title.replace(/<[^>]*>/g, '')
    setSelected({
      name,
      address: item.roadAddress || item.address,
      lat: parseFloat(item.mapy) / 1e7,
      lng: parseFloat(item.mapx) / 1e7,
      naver_url: item.link,
    })
    setStep('detail')
  }

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const toggleLevelTag = tag => setField('levelTags',
    form.levelTags.includes(tag) ? form.levelTags.filter(t => t !== tag) : [...form.levelTags, tag]
  )
  const setPhoto = (i, val) => setField('photos', form.photos.map((p, j) => j === i ? val : p))

  const handleSave = () => {
    if (!selected) return
    if (form.status === 'visited' && !form.axis_taste && !form.axis_revisit && !form.axis_unique) {
      alert('방문완료 식당은 판단 3축 중 최소 1개를 선택해주세요.')
      return
    }
    const freeParsed = form.freeTags.split(/[,\s]+/).filter(t => t)
      .map(t => t.startsWith('#') ? t : `#${t}`)

    onSave({
      name: selected.name,
      address: selected.address,
      lat: selected.lat,
      lng: selected.lng,
      naver_url: selected.naver_url || null,
      status: form.status,
      source: form.status === 'wishlist' && form.recommender ? 'recommendation' : 'self',
      recommender: form.recommender || null,
      memo: form.memo || null,
      axis_taste: form.status === 'visited' ? form.axis_taste : false,
      axis_revisit: form.status === 'visited' ? form.axis_revisit : false,
      axis_unique: form.status === 'visited' ? form.axis_unique : false,
      _tags: [
        ...form.levelTags.map(t => ({ tag: t, tag_type: 'level' })),
        ...freeParsed.map(t => ({ tag: t, tag_type: 'free' })),
      ],
      _photos: form.photos
        .map((url, i) => ({ image_url: url.trim(), display_order: i + 1 }))
        .filter(p => p.image_url),
    })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 300 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '88vh', overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>
            {step === 'search' ? '🔍 식당 검색' : '📝 정보 입력'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>

        {step === 'search' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="식당명 또는 주소 검색..."
                style={{ ...inputStyle, flex: 1 }}
                autoFocus
              />
              <button onClick={search} disabled={loading}
                style={{ padding: '10px 18px', borderRadius: '8px', background: '#FF6B35', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}>
                {loading ? '...' : '검색'}
              </button>
            </div>
            {results.length === 0 && !loading && query && (
              <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: '14px', padding: '20px 0' }}>검색 결과가 없습니다</p>
            )}
            {results.map((item, i) => (
              <div key={i} onClick={() => pick(item)}
                style={{ padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', marginBottom: '8px', cursor: 'pointer' }}>
                <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '3px' }}
                  dangerouslySetInnerHTML={{ __html: item.title.replace(/<b>/g, '<b style="color:#FF6B35">') }} />
                <div style={{ fontSize: '13px', color: '#6B7280' }}>{item.roadAddress || item.address}</div>
                {item.category && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{item.category}</div>}
              </div>
            ))}
          </>
        )}

        {step === 'detail' && selected && (
          <>
            {/* 선택된 식당 표시 */}
            <div style={{ padding: '12px', background: '#F9FAFB', borderRadius: '10px', marginBottom: '20px' }}>
              <div style={{ fontWeight: '600', fontSize: '15px' }}>{selected.name}</div>
              <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>{selected.address}</div>
            </div>

            {/* 상태 */}
            <div style={{ marginBottom: '18px' }}>
              <span style={label('상태')}>상태</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { val: 'visited', label: '✓ 방문완료' },
                  { val: 'wishlist', label: '☆ 위시리스트' },
                ].map(s => (
                  <button key={s.val} onClick={() => setField('status', s.val)}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '10px',
                      border: form.status === s.val ? 'none' : '1px solid #E5E7EB',
                      background: form.status === s.val ? (s.val === 'visited' ? '#FF6B35' : '#475569') : 'white',
                      color: form.status === s.val ? 'white' : '#374151',
                      cursor: 'pointer', fontWeight: form.status === s.val ? '700' : '400', fontSize: '14px',
                    }}>{s.label}</button>
                ))}
              </div>
            </div>

            {/* 판단 3축 (방문완료만) */}
            {form.status === 'visited' && (
              <div style={{ marginBottom: '18px' }}>
                <span style={label('판단 3축')}>
                  판단 3축 <span style={{ color: '#FF6B35', fontWeight: '400' }}>(최소 1개 선택)</span>
                </span>
                {AXIS_LIST.map(a => (
                  <label key={a.key} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', marginBottom: '6px',
                    borderRadius: '10px', background: form[a.key] ? '#FFF5EE' : '#F9FAFB', cursor: 'pointer',
                  }}>
                    <input type="checkbox" checked={form[a.key]}
                      onChange={e => setField(a.key, e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#FF6B35', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#111827' }}>{a.label}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>{a.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* 수준 태그 */}
            <div style={{ marginBottom: '18px' }}>
              <span style={label()}>수준 태그</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {LEVEL_TAGS.map(tag => (
                  <button key={tag} onClick={() => toggleLevelTag(tag)}
                    style={{
                      padding: '7px 16px', borderRadius: '18px', border: 'none', cursor: 'pointer',
                      background: form.levelTags.includes(tag) ? '#FF6B35' : '#FFF5EE',
                      color: form.levelTags.includes(tag) ? 'white' : '#FF6B35',
                      fontSize: '14px', fontWeight: '500',
                    }}>{tag}</button>
                ))}
              </div>
            </div>

            {/* 자유 태그 */}
            <div style={{ marginBottom: '18px' }}>
              <span style={label()}>자유 태그</span>
              <input value={form.freeTags} onChange={e => setField('freeTags', e.target.value)}
                placeholder="#한식 #주차가능 (쉼표·공백으로 구분)"
                style={inputStyle} />
            </div>

            {/* 메모 */}
            <div style={{ marginBottom: '18px' }}>
              <span style={label()}>메모</span>
              <textarea value={form.memo} onChange={e => setField('memo', e.target.value)}
                placeholder="기억하고 싶은 내용을 자유롭게..."
                rows={3}
                style={{ ...inputStyle, resize: 'none' }} />
            </div>

            {/* 사진 URL */}
            <div style={{ marginBottom: '18px' }}>
              <span style={label()}>사진 URL (최대 3장)</span>
              {form.photos.map((url, i) => (
                <input key={i} value={url} onChange={e => setPhoto(i, e.target.value)}
                  placeholder={`이미지 URL ${i + 1}`}
                  style={{ ...inputStyle, marginBottom: '6px' }} />
              ))}
              <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>네이버 플레이스 이미지 URL을 붙여넣으세요</p>
            </div>

            {/* 추천인 (위시리스트) */}
            {form.status === 'wishlist' && (
              <div style={{ marginBottom: '18px' }}>
                <span style={label()}>추천인</span>
                <input value={form.recommender} onChange={e => setField('recommender', e.target.value)}
                  placeholder="누구에게 추천받았나요?"
                  style={inputStyle} />
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep('search')}
                style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '14px' }}>
                ← 뒤로
              </button>
              <button onClick={handleSave}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#FF6B35', color: 'white', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>
                저장
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

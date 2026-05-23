// 여러 식당 일괄 등록 모드
// 텍스트 영역에 줄바꿈으로 식당명 입력 → 일괄 검색 → 체크박스 선택 → 일괄 저장

import { useState } from 'react'

const STATUS_OPTIONS = [
  { val: 'wishlist', label: '☆ 위시리스트', color: '#475569' },
  { val: 'visited', label: '✓ 방문완료', color: '#FF385C' },
]

const sectionLabel = {
  fontSize: '13px', fontWeight: '600', color: '#374151',
  display: 'block', marginBottom: '8px',
}
const inputBase = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #E5E7EB', fontSize: '14px', outline: 'none',
  boxSizing: 'border-box',
}

export default function BulkAdd({ onSave, onClose }) {
  const [step, setStep] = useState('input') // 'input' | 'searching' | 'review'
  const [text, setText] = useState('')
  const [status, setStatus] = useState('wishlist')
  const [commonTags, setCommonTags] = useState('#네이버저장')
  const [commonMemo, setCommonMemo] = useState('출처: 네이버 MY플레이스')
  const [recommender, setRecommender] = useState('네이버 별표')
  const [results, setResults] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  const handleSearch = async () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    setStep('searching')
    setProgress({ done: 0, total: lines.length })

    const out = []
    for (let i = 0; i < lines.length; i++) {
      const q = lines[i]
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`)
        const data = await res.json()
        const items = data.items || []
        if (items.length > 0) {
          // 첫 번째 결과를 기본 선택
          const item = items[0]
          out.push({
            query: q,
            name: item.title.replace(/<[^>]*>/g, ''),
            address: item.roadAddress || item.address || '',
            lat: parseFloat(item.mapy) / 1e7,
            lng: parseFloat(item.mapx) / 1e7,
            naver_url: item.link || null,
            category: item.category || '',
            selected: true,
            alternatives: items.slice(1, 4).map(it => ({
              name: it.title.replace(/<[^>]*>/g, ''),
              address: it.roadAddress || it.address || '',
              lat: parseFloat(it.mapy) / 1e7,
              lng: parseFloat(it.mapx) / 1e7,
              naver_url: it.link || null,
              category: it.category || '',
            })),
          })
        } else {
          out.push({ query: q, name: null, selected: false, alternatives: [] })
        }
      } catch {
        out.push({ query: q, name: null, selected: false, alternatives: [], error: true })
      }
      setProgress({ done: i + 1, total: lines.length })
      await new Promise(r => setTimeout(r, 120))
    }
    setResults(out)
    setStep('review')
  }

  const toggleSelect = (i) => {
    setResults(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r))
  }

  // 대체 결과로 교체
  const replaceWithAlternative = (i, altIdx) => {
    setResults(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const alt = r.alternatives[altIdx]
      const current = { name: r.name, address: r.address, lat: r.lat, lng: r.lng, naver_url: r.naver_url, category: r.category }
      const newAlts = r.alternatives.filter((_, j) => j !== altIdx)
      newAlts.unshift(current)
      return { ...r, ...alt, alternatives: newAlts }
    }))
  }

  const handleSave = async () => {
    const selected = results.filter(r => r.selected && r.name)
    if (selected.length === 0) { alert('선택된 항목이 없습니다.'); return }

    const tags = commonTags.split(/[,\s]+/).filter(Boolean)
      .map(t => t.startsWith('#') ? t : `#${t}`)
      .map(tag => ({ tag, tag_type: 'free' }))

    const payloads = selected.map(r => ({
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      naver_url: r.naver_url || null,
      status,
      source: 'recommendation',
      recommender: recommender || null,
      memo: commonMemo || null,
      axis_taste: status === 'visited',  // 방문완료 시 맛은 기본 인정 (단이님이 별표한 곳이므로)
      axis_revisit: false,
      axis_unique: false,
      _tags: tags,
      _photos: [],
    }))

    await onSave(payloads)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 300 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700' }}>
            {step === 'input' && '📋 여러 곳 한번에 등록'}
            {step === 'searching' && '🔍 검색 중...'}
            {step === 'review' && '✏️ 결과 확인 후 저장'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>

        {step === 'input' && (
          <>
            <div style={{ marginBottom: '16px' }}>
              <span style={sectionLabel}>식당명 (한 줄에 하나씩)</span>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="광장시장 빈대떡&#10;홍대 어니언 본점&#10;명동교자&#10;..."
                rows={8}
                style={{ ...inputBase, resize: 'vertical', fontFamily: 'monospace' }}
                autoFocus
              />
              <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                {text.split('\n').filter(l => l.trim()).length}개 입력됨
              </p>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={sectionLabel}>공통 상태</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {STATUS_OPTIONS.map(s => (
                  <button key={s.val} onClick={() => setStatus(s.val)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px',
                      border: status === s.val ? 'none' : '1px solid #E5E7EB',
                      background: status === s.val ? s.color : 'white',
                      color: status === s.val ? 'white' : '#374151',
                      cursor: 'pointer', fontWeight: status === s.val ? '700' : '400', fontSize: '14px',
                    }}>{s.label}</button>
                ))}
              </div>
              {status === 'visited' && (
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                  방문완료 선택 시 '맛' 축이 자동 체크됩니다. 나중에 개별 수정 가능.
                </p>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={sectionLabel}>공통 자유 태그 (쉼표·공백 구분)</span>
              <input value={commonTags} onChange={e => setCommonTags(e.target.value)} style={inputBase} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={sectionLabel}>공통 추천인</span>
              <input value={recommender} onChange={e => setRecommender(e.target.value)} style={inputBase} />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <span style={sectionLabel}>공통 메모</span>
              <input value={commonMemo} onChange={e => setCommonMemo(e.target.value)} style={inputBase} />
            </div>

            <button onClick={handleSearch}
              disabled={text.split('\n').filter(l => l.trim()).length === 0}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                background: '#FF385C', color: 'white', cursor: 'pointer',
                fontSize: '15px', fontWeight: '700', opacity: text.trim() ? 1 : 0.5,
              }}>
              🔍 일괄 검색 시작
            </button>
          </>
        )}

        {step === 'searching' && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ fontSize: '15px', color: '#374151', marginBottom: '12px' }}>
              검색 중... {progress.done} / {progress.total}
            </div>
            <div style={{ width: '100%', height: '6px', background: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${(progress.done / progress.total) * 100}%`,
                height: '100%', background: '#FF385C', transition: 'width 0.2s',
              }} />
            </div>
          </div>
        )}

        {step === 'review' && (
          <>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '12px' }}>
              체크박스로 저장할 항목을 선택. 다른 결과로 바꾸려면 ▾ 클릭.
            </p>
            {results.map((r, i) => (
              <div key={i} style={{
                padding: '10px 12px', marginBottom: '8px', borderRadius: '10px',
                border: '1px solid #E5E7EB',
                background: r.selected ? '#FFF8F8' : 'white',
                opacity: r.name ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={() => toggleSelect(i)}
                    disabled={!r.name}
                    style={{ width: '18px', height: '18px', accentColor: '#FF385C', marginTop: '2px', flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '2px' }}>
                      입력: {r.query}
                    </div>
                    {r.name ? (
                      <>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{r.name}</div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>{r.address}</div>
                        {r.category && (
                          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{r.category}</div>
                        )}
                        {r.alternatives.length > 0 && (
                          <details style={{ marginTop: '6px' }}>
                            <summary style={{ fontSize: '12px', color: '#FF385C', cursor: 'pointer' }}>
                              다른 결과로 교체 ▾ ({r.alternatives.length}개)
                            </summary>
                            <div style={{ marginTop: '6px', paddingLeft: '8px' }}>
                              {r.alternatives.map((alt, j) => (
                                <button
                                  key={j}
                                  onClick={() => replaceWithAlternative(i, j)}
                                  style={{
                                    display: 'block', width: '100%', textAlign: 'left',
                                    padding: '6px 8px', marginBottom: '4px', borderRadius: '6px',
                                    border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer',
                                    fontSize: '12px',
                                  }}
                                >
                                  <strong>{alt.name}</strong>
                                  <span style={{ color: '#9CA3AF', marginLeft: '6px' }}>{alt.address}</span>
                                </button>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#EF4444' }}>
                        {r.error ? '검색 오류' : '검색 결과 없음'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', position: 'sticky', bottom: 0, background: 'white', padding: '8px 0' }}>
              <button onClick={() => setStep('input')}
                style={{ padding: '12px 20px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '14px' }}>
                ← 다시 입력
              </button>
              <button onClick={handleSave}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#FF385C', color: 'white', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>
                선택한 {results.filter(r => r.selected && r.name).length}개 저장
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

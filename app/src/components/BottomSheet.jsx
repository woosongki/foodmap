import { useState, useEffect } from 'react'

const AXIS = [
  { key: 'axis_taste', label: '맛' },
  { key: 'axis_revisit', label: '재방문 의사' },
  { key: 'axis_unique', label: '희소성·특별함' },
]

export default function BottomSheet({ restaurant, onClose, isAuthenticated, onDelete, onUpdate, onEditRequest }) {
  const [editing, setEditing] = useState(false)
  const [editMemo, setEditMemo] = useState(restaurant.memo || '')

  useEffect(() => {
    setEditing(false)
    setEditMemo(restaurant.memo || '')
  }, [restaurant.id])

  const levelTags = (restaurant.tags || []).filter(t => t.tag_type === 'level')
  const freeTags = (restaurant.tags || []).filter(t => t.tag_type === 'free')
  const photos = [...(restaurant.photos || [])].sort((a, b) => a.display_order - b.display_order)

  const handleStatusToggle = async () => {
    const next = restaurant.status === 'visited' ? 'wishlist' : 'visited'
    await onUpdate(restaurant.id, { status: next })
  }

  const handleMemoSave = async () => {
    await onUpdate(restaurant.id, { memo: editMemo })
    setEditing(false)
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: 'white', borderRadius: '24px 24px 0 0',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.10)',
      maxHeight: '65vh', overflowY: 'auto',
      zIndex: 200, padding: '0 18px 24px',
    }}>
      {/* 드래그 핸들 */}
      <div style={{ position: 'sticky', top: 0, background: 'white', paddingTop: '10px', paddingBottom: '10px', zIndex: 1 }}>
        <div style={{ width: '42px', height: '4px', background: '#E5E7EB', borderRadius: '2px', margin: '0 auto' }} />
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', marginBottom: '4px', letterSpacing: '-0.3px' }}>
            {restaurant.name}
          </h2>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>{restaurant.address}</p>
        </div>
        <button onClick={onClose}
          style={{
            background: '#F9FAFB', border: 'none', borderRadius: '50%',
            width: '32px', height: '32px', cursor: 'pointer', color: '#6B7280',
            fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>✕</button>
      </div>

      {/* 상태 배지 */}
      <div style={{ marginBottom: '14px' }}>
        <span style={{
          display: 'inline-block',
          padding: '5px 13px', borderRadius: '9999px', fontSize: '12px', fontWeight: '600',
          background: restaurant.status === 'visited' ? '#FFE9DC' : '#F3F4F6',
          color: restaurant.status === 'visited' ? '#E85A2C' : '#6B7280',
        }}>
          {restaurant.status === 'visited' ? '✓ 방문완료' : '☆ 위시리스트'}
        </span>
        {isAuthenticated && (
          <button onClick={handleStatusToggle} style={{
            marginLeft: '10px', background: 'none', border: 'none',
            fontSize: '12px', color: '#9CA3AF', cursor: 'pointer',
          }}>전환 ⇄</button>
        )}
      </div>

      {/* 사진 */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', overflowX: 'auto' }}>
          {photos.map(p => (
            <img key={p.id} src={p.image_url} alt={restaurant.name}
              style={{ height: '140px', width: '190px', objectFit: 'cover', borderRadius: '14px', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none' }}
            />
          ))}
        </div>
      )}

      {/* 판단 3축 */}
      {restaurant.status === 'visited' && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {AXIS.filter(a => restaurant[a.key]).map(a => (
            <span key={a.key} style={{
              padding: '5px 12px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500',
              background: '#FFF5EE', color: '#E85A2C',
            }}>✓ {a.label}</span>
          ))}
        </div>
      )}

      {/* 태그 */}
      {(levelTags.length > 0 || freeTags.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          {levelTags.map(t => (
            <span key={t.tag} style={{ padding: '5px 12px', borderRadius: '9999px', fontSize: '12px', background: '#FFF5EE', color: '#FF6B35', fontWeight: '500' }}>{t.tag}</span>
          ))}
          {freeTags.map(t => (
            <span key={t.tag} style={{ padding: '5px 12px', borderRadius: '9999px', fontSize: '12px', background: '#F9FAFB', color: '#6B7280' }}>{t.tag}</span>
          ))}
        </div>
      )}

      {/* 메모 */}
      {editing ? (
        <div style={{ marginBottom: '14px' }}>
          <textarea
            value={editMemo} onChange={e => setEditMemo(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '14px', resize: 'none', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => setEditing(false)} style={{ padding: '9px 18px', borderRadius: '12px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '13px', color: '#6B7280' }}>취소</button>
            <button onClick={handleMemoSave} style={{ padding: '9px 18px', borderRadius: '12px', border: 'none', background: '#FF6B35', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>저장</button>
          </div>
        </div>
      ) : restaurant.memo ? (
        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {restaurant.memo}
        </p>
      ) : isAuthenticated ? (
        <button onClick={() => setEditing(true)} style={{ marginBottom: '14px', background: 'none', border: 'none', fontSize: '13px', color: '#FF6B35', cursor: 'pointer', padding: 0, fontWeight: '500' }}>
          + 메모 추가
        </button>
      ) : null}

      {restaurant.memo && isAuthenticated && !editing && (
        <button onClick={() => setEditing(true)} style={{ marginBottom: '14px', background: 'none', border: 'none', fontSize: '13px', color: '#9CA3AF', cursor: 'pointer', padding: 0 }}>메모 수정</button>
      )}

      {/* 추천인 */}
      {restaurant.recommender && (
        <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '14px' }}>추천: {restaurant.recommender}</p>
      )}

      {/* 네이버 지도 링크 */}
      {restaurant.naver_url && (
        <a href={restaurant.naver_url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '13px', borderRadius: '14px', marginBottom: '10px',
            background: '#03C75A', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: '600',
            boxShadow: '0 4px 12px rgba(3,199,90,0.20)',
          }}>
          네이버 지도에서 보기
        </a>
      )}

      {/* 편집/삭제 */}
      {isAuthenticated ? (
        <button
          onClick={() => { if (window.confirm('삭제하시겠어요?')) onDelete(restaurant.id) }}
          style={{ width: '100%', padding: '13px', borderRadius: '14px', border: 'none', background: '#FFF5EE', color: '#FF6B35', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
        >삭제</button>
      ) : (
        <button onClick={onEditRequest}
          style={{ width: '100%', padding: '13px', borderRadius: '14px', border: '1px solid #F3F4F6', background: 'white', color: '#9CA3AF', cursor: 'pointer', fontSize: '13px' }}>
          🔒 편집 모드 (비밀번호 필요)
        </button>
      )}
    </div>
  )
}

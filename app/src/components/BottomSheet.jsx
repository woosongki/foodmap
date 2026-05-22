import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
      background: 'white', borderRadius: '20px 20px 0 0',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
      maxHeight: '65vh', overflowY: 'auto',
      zIndex: 200, padding: '0 16px 24px',
    }}>
      {/* 드래그 핸들 */}
      <div style={{ position: 'sticky', top: 0, background: 'white', paddingTop: '10px', paddingBottom: '8px' }}>
        <div style={{ width: '40px', height: '4px', background: '#E5E7EB', borderRadius: '2px', margin: '0 auto' }} />
      </div>

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flex: 1, marginRight: '12px' }}>
          <h2 style={{ fontSize: '19px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
            {restaurant.name}
          </h2>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>{restaurant.address}</p>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#9CA3AF', padding: '2px' }}>✕</button>
      </div>

      {/* 상태 배지 */}
      <div style={{ marginBottom: '12px' }}>
        <span style={{
          display: 'inline-block',
          padding: '4px 12px', borderRadius: '14px', fontSize: '12px', fontWeight: '600',
          background: restaurant.status === 'visited' ? '#FFE4E8' : '#E2E8F0',
          color: restaurant.status === 'visited' ? '#FF385C' : '#475569',
        }}>
          {restaurant.status === 'visited' ? '✓ 방문완료' : '☆ 위시리스트'}
        </span>
        {isAuthenticated && (
          <button onClick={handleStatusToggle} style={{
            marginLeft: '8px', background: 'none', border: 'none',
            fontSize: '12px', color: '#9CA3AF', cursor: 'pointer', textDecoration: 'underline',
          }}>전환</button>
        )}
      </div>

      {/* 사진 */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', overflowX: 'auto' }}>
          {photos.map(p => (
            <img key={p.id} src={p.image_url} alt={restaurant.name}
              style={{ height: '130px', width: '180px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none' }}
            />
          ))}
        </div>
      )}

      {/* 판단 3축 */}
      {restaurant.status === 'visited' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {AXIS.filter(a => restaurant[a.key]).map(a => (
            <span key={a.key} style={{
              padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '500',
              background: '#FFF1F3', color: '#FF385C',
            }}>✓ {a.label}</span>
          ))}
        </div>
      )}

      {/* 태그 */}
      {(levelTags.length > 0 || freeTags.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {levelTags.map(t => (
            <span key={t.tag} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', background: '#FFF1F3', color: '#FF385C' }}>{t.tag}</span>
          ))}
          {freeTags.map(t => (
            <span key={t.tag} style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', background: '#F3F4F6', color: '#374151' }}>{t.tag}</span>
          ))}
        </div>
      )}

      {/* 메모 */}
      {editing ? (
        <div style={{ marginBottom: '12px' }}>
          <textarea
            value={editMemo} onChange={e => setEditMemo(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '14px', resize: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button onClick={() => setEditing(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '13px' }}>취소</button>
            <button onClick={handleMemoSave} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#FF385C', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>저장</button>
          </div>
        </div>
      ) : restaurant.memo ? (
        <p style={{ fontSize: '14px', color: '#374151', marginBottom: '12px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {restaurant.memo}
        </p>
      ) : isAuthenticated ? (
        <button onClick={() => setEditing(true)} style={{ marginBottom: '12px', background: 'none', border: 'none', fontSize: '13px', color: '#9CA3AF', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
          + 메모 추가
        </button>
      ) : null}

      {restaurant.memo && isAuthenticated && !editing && (
        <button onClick={() => setEditing(true)} style={{ marginBottom: '12px', background: 'none', border: 'none', fontSize: '13px', color: '#9CA3AF', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>메모 수정</button>
      )}

      {/* 추천인 */}
      {restaurant.recommender && (
        <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '12px' }}>추천: {restaurant.recommender}</p>
      )}

      {/* 네이버 지도 링크 */}
      {restaurant.naver_url && (
        <a href={restaurant.naver_url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '11px', borderRadius: '10px', marginBottom: '10px',
            background: '#03C75A', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: '600',
          }}>
          네이버 지도에서 보기
        </a>
      )}

      {/* 편집/삭제 */}
      {isAuthenticated ? (
        <button
          onClick={() => { if (window.confirm('삭제하시겠어요?')) onDelete(restaurant.id) }}
          style={{ width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: '#FFF1F3', color: '#FF385C', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
        >삭제</button>
      ) : (
        <button onClick={onEditRequest}
          style={{ width: '100%', padding: '11px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', color: '#6B7280', cursor: 'pointer', fontSize: '13px' }}>
          편집 모드 (비밀번호 필요)
        </button>
      )}
    </div>
  )
}

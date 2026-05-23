import { useState } from 'react'

export default function AuthModal({ onSuccess, onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  const submit = () => {
    if (password === import.meta.env.VITE_EDIT_PASSWORD) {
      onSuccess()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px 24px', width: '300px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '700', color: '#111827' }}>편집 모드</h3>
        <p style={{ margin: '0 0 18px', fontSize: '13px', color: '#9CA3AF' }}>비밀번호를 입력하면 식당을 추가·삭제할 수 있습니다</p>
        <input
          type="password" value={password}
          onChange={e => { setPassword(e.target.value); setError(false) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="비밀번호"
          autoFocus
          style={{
            width: '100%', padding: '11px 12px', borderRadius: '10px',
            border: `1.5px solid ${error ? '#FF6B35' : '#E5E7EB'}`,
            fontSize: '15px', marginBottom: error ? '6px' : '16px',
            outline: 'none', boxSizing: 'border-box',
            background: error ? '#FFF5F5' : 'white',
          }}
        />
        {error && <p style={{ color: '#FF6B35', fontSize: '13px', marginBottom: '12px' }}>비밀번호가 틀렸습니다</p>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>취소</button>
          <button onClick={submit}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#FF6B35', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>확인</button>
        </div>
      </div>
    </div>
  )
}

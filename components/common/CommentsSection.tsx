'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Comment, CommentEntityType } from '@/types/comment'

interface CommentsSectionProps {
  entityType: CommentEntityType
  entityId: string
  currentUser: { name: string; username: string }
}

export function CommentsSection({ entityType, entityId, currentUser }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/comments?entity_type=${entityType}&entity_id=${entityId}`, {
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!newComment.trim()) return

    try {
      setSubmitting(true)
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'add',
          entity_type: entityType,
          entity_id: entityId,
          content: newComment.trim(),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
        setNewComment('')
        // 댓글 목록 상단으로 스크롤
        setTimeout(() => {
          const commentsList = document.getElementById('comments-list')
          if (commentsList) {
            commentsList.scrollTop = 0
          }
        }, 100)
      } else {
        alert('댓글 추가에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error adding comment:', error)
      alert('댓글 추가 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditingContent(comment.content)
  }

  const handleCancelEdit = () => {
    setEditingCommentId(null)
    setEditingContent('')
  }

  const handleUpdate = async (commentId: string) => {
    if (!editingContent.trim()) return

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update',
          commentId,
          content: editingContent.trim(),
          entity_type: entityType,
          entity_id: entityId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
        setEditingCommentId(null)
        setEditingContent('')
      } else {
        alert('댓글 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error updating comment:', error)
      alert('댓글 수정 중 오류가 발생했습니다.')
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete',
          commentId,
          entity_type: entityType,
          entity_id: entityId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setComments(data.comments || [])
      } else {
        alert('댓글 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
      alert('댓글 삭제 중 오류가 발생했습니다.')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '방금 전'
    if (diffMins < 60) return `${diffMins}분 전`
    if (diffHours < 24) return `${diffHours}시간 전`
    if (diffDays < 7) return `${diffDays}일 전`

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', color: '#111827' }}>
        진행 상황 기록
      </h3>

      {/* 댓글 목록 */}
      <div 
        id="comments-list"
        style={{ marginBottom: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}
      >
        {loading ? (
          <p style={{ color: '#6b7280', fontSize: '0.75rem' }}>로딩 중...</p>
        ) : comments.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.75rem' }}>아직 기록이 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {comments.map((comment) => (
              <div
                key={comment.id}
                style={{
                  padding: '0.5rem',
                  background: '#f9fafb',
                  borderRadius: '0.375rem',
                  border: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.375rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.75rem', color: '#111827' }}>
                        {comment.author}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#6b7280', marginLeft: '0.375rem' }}>
                        {formatDate(comment.created_at)}
                      </span>
                      {comment.updated_at !== comment.created_at && (
                        <span style={{ fontSize: '0.65rem', color: '#9ca3af', marginLeft: '0.375rem' }}>
                          (수정됨)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.625rem', color: '#9ca3af' }}>
                      작성: {formatFullDate(comment.created_at)}
                      {comment.updated_at !== comment.created_at && (
                        <span style={{ marginLeft: '0.375rem' }}>
                          수정: {formatFullDate(comment.updated_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  {comment.author === currentUser.name && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {editingCommentId === comment.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(comment.id)}
                            style={{
                              background: '#3b82f6',
                              border: 'none',
                              color: 'white',
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '0.25rem',
                            }}
                          >
                            저장
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            style={{
                              background: '#6b7280',
                              border: 'none',
                              color: 'white',
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              padding: '0.2rem 0.4rem',
                              borderRadius: '0.25rem',
                            }}
                          >
                            취소
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(comment)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#3b82f6',
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              padding: '0.2rem 0.4rem',
                            }}
                          >
                            수정
                          </button>
                          <button
                            onClick={() => handleDelete(comment.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              padding: '0.2rem 0.4rem',
                            }}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {editingCommentId === comment.id ? (
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    rows={2}
                    style={{
                      width: '100%',
                      padding: '0.375rem',
                      border: '1px solid #3b82f6',
                      borderRadius: '0.375rem',
                      fontSize: '0.75rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                    autoFocus
                  />
                ) : (
                  <p style={{ fontSize: '0.75rem', color: '#374151', lineHeight: '1.4', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {comment.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 댓글 입력 폼 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              handleSubmit(e as any)
            }
          }}
          placeholder="진행 상황을 기록하세요... (Ctrl+Enter로 등록)"
          rows={2}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '60px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            style={{
              padding: '0.375rem 0.75rem',
              background: submitting || !newComment.trim() ? '#d1d5db' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: submitting || !newComment.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </div>
    </div>
  )
}


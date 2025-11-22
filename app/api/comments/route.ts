import { NextRequest, NextResponse } from 'next/server'
import {
  getComments,
  addComment,
  updateComment,
  deleteComment,
  getNextCommentId,
} from '@/lib/db'
import type { Comment, CommentEntityType } from '@/types/comment'
import { verifySession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // 세션 확인
    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const session = await verifySession(token)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entity_type') as CommentEntityType
    const entityId = searchParams.get('entity_id')

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entity_type and entity_id are required' },
        { status: 400 }
      )
    }

    const comments = await getComments(entityType, entityId)
    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to fetch comments: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // 세션 확인
    const token = request.cookies.get('session')?.value
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const session = await verifySession(token)
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const action = body.action

    if (action === 'add') {
      const commentId = body.comment?.id || await getNextCommentId()
      const newComment: Comment = {
        id: commentId,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        author: session.name || session.username,
        content: body.content,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      await addComment(newComment)
      const comments = await getComments(body.entity_type, body.entity_id)
      return NextResponse.json({ success: true, comments })
    } else if (action === 'update') {
      await updateComment(body.commentId, body.content)
      const comments = await getComments(body.entity_type, body.entity_id)
      return NextResponse.json({ success: true, comments })
    } else if (action === 'delete') {
      await deleteComment(body.commentId)
      const comments = await getComments(body.entity_type, body.entity_id)
      return NextResponse.json({ success: true, comments })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error processing comment request:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to process comment: ${errorMessage}` },
      { status: 500 }
    )
  }
}


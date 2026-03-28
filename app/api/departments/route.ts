import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listDepartments, createDepartment, deleteDepartment } from '@/lib/departments'

/** 부서 목록: 회원가입 폼·설정 등에서 사용 (조회 전용, 이름만 노출) */
export async function GET() {
  try {
    const departments = await listDepartments()
    return NextResponse.json({ departments })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to list departments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && !session.isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Department name required' }, { status: 400 })
    }
    const id = await createDepartment(name)
    const departments = await listDepartments()
    return NextResponse.json({ success: true, id, departments })
  } catch (e: any) {
    const msg = e?.message || 'Failed to create department'
    const status = msg.includes('Duplicate') || msg.includes('UNIQUE') ? 409 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || (session.role !== 'admin' && !session.isAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const { searchParams } = new URL(request.url)
    const id = Number(searchParams.get('id'))
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    await deleteDepartment(id)
    const departments = await listDepartments()
    return NextResponse.json({ success: true, departments })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}

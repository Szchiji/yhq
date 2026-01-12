import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdmin } from '@/lib/api-auth'

type Params = {
  params: {
    id: string
  }
}

// DELETE /api/blacklist/[id] - 移出黑名单
export async function DELETE(request: NextRequest, { params }: Params) {
  const adminId = await verifyAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Check if blacklist record exists
    const existing = await prisma.blacklist.findUnique({
      where: { id: params.id }
    })
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Blacklist record not found' },
        { status: 404 }
      )
    }

    await prisma.blacklist.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from blacklist:', error)
    return NextResponse.json(
      { error: 'Failed to remove from blacklist' },
      { status: 500 }
    )
  }
}

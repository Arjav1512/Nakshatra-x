import { type NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { requireAdmin } from '@/lib/auth'
import path from 'path'

const dataFilePath = path.join(process.cwd(), 'src', 'data', 'mines.json')

export async function GET() {
  try {
    const fileContents = await fs.readFile(dataFilePath, 'utf8')
    return NextResponse.json(JSON.parse(fileContents))
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read data' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  // This was an UNAUTHENTICATED write. Anyone who could reach the app could
  // PUT arbitrary JSON over the mine register on disk — the same register the
  // dashboard reads. The comment that stood here said "In a real app, verify
  // the admin session here before allowing changes".
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const updatedData = await request.json()
    await fs.writeFile(dataFilePath, JSON.stringify(updatedData, null, 2), 'utf8')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to write data' }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
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
  try {
    // In a real app, verify the admin session here before allowing changes
    const updatedData = await request.json()
    await fs.writeFile(dataFilePath, JSON.stringify(updatedData, null, 2), 'utf8')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to write data' }, { status: 500 })
  }
}

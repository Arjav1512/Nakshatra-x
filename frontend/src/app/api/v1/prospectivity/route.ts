import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'src', 'data', 'prospectivity.geojson')
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Prospectivity GeoJSON not found. Run the ML pipeline scripts first.' },
        { status: 404 }
      )
    }
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const geojson = JSON.parse(fileContent)
    return NextResponse.json(geojson)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

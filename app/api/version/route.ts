import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
    return NextResponse.json({ version: packageJson.version || '0.1.0' })
  } catch (error) {
    console.error('Error reading package.json:', error)
    return NextResponse.json({ version: '0.1.0' })
  }
}


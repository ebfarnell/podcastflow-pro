import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get('text') || 'U'
  const bg = searchParams.get('bg') || 'auto'
  const color = searchParams.get('color') || 'white'
  const size = searchParams.get('size') || '40x40'
  
  const [width, height] = size.split('x').map(Number)
  
  // Generate background color based on text if auto
  let backgroundColor = '#4f46e5'
  if (bg === 'auto') {
    const colors = [
      '#4f46e5', '#06b6d4', '#10b981', '#f59e0b',
      '#ef4444', '#8b5cf6', '#f97316', '#84cc16',
      '#6366f1', '#14b8a6', '#eab308', '#ec4899'
    ]
    const colorIndex = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    backgroundColor = colors[colorIndex]
  } else {
    backgroundColor = bg
  }
  
  const fontSize = Math.min(width, height) * 0.4
  
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${width/2}" cy="${height/2}" r="${Math.min(width, height)/2}" fill="${backgroundColor}"/>
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        dominant-baseline="middle"
        fill="${color}" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${fontSize}px" 
        font-weight="500"
      >
        ${text.slice(0, 2).toUpperCase()}
      </text>
    </svg>
  `
  
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get('text') || 'Podcast'
  const bg = searchParams.get('bg') || 'gradient'
  const size = searchParams.get('size') || '300x300'
  
  const [width, height] = size.split('x').map(Number)
  
  // Generate a deterministic color based on text
  const colors = [
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'],
    ['#a8edea', '#fed6e3'],
    ['#ff9a9e', '#fecfef'],
    ['#ffecd2', '#fcb69f'],
  ]
  
  const colorIndex = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  const [color1, color2] = colors[colorIndex]
  
  // Get initials or first letters
  const initials = text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .slice(0, 2) || 'P'
  
  const fontSize = Math.min(width, height) * 0.3
  
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" rx="${Math.min(width, height) * 0.05}"/>
      <text 
        x="50%" 
        y="50%" 
        text-anchor="middle" 
        dominant-baseline="middle"
        fill="white" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="${fontSize}px" 
        font-weight="600"
        style="text-shadow: 0 2px 4px rgba(0,0,0,0.3)"
      >
        ${initials}
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
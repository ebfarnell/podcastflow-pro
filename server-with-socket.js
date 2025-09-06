const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server: SocketServer } = require('socket.io')
const path = require('path')
const fs = require('fs')

// Load environment variables
const envPath = path.join(__dirname, '.env.production')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=')
      const value = valueParts.join('=').replace(/^["']|["']$/g, '')
      process.env[key.trim()] = value.trim()
    }
  })
  console.log('✅ Loaded environment variables from .env.production')
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT, 10) || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO
  const io = new SocketServer(server, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'https://app.podcastflow.pro',
      credentials: true
    },
    path: '/socket.io'
  })

  // Import and initialize socket server logic
  const initSocketServer = async () => {
    try {
      // Import the compiled socket server module
      const socketModule = require('./.next/server/chunks/socket-server.js')
      if (socketModule.initializeSocketServer) {
        socketModule.initializeSocketServer(io)
      }
    } catch (error) {
      console.log('Socket server module not found, using basic setup')
      
      // Basic socket setup
      io.on('connection', (socket) => {
        console.log('🔌 Client connected:', socket.id)
        
        socket.on('disconnect', () => {
          console.log('🔌 Client disconnected:', socket.id)
        })
      })
    }
  }

  initSocketServer()

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log('> WebSocket server ready on /socket.io')
  })
})
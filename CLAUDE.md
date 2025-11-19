# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CallMe** - простой веб-портал для групповых видеозвонков с автоматическим присоединением.

This is a Next.js 16 application using the App Router architecture with TypeScript, React 19, Tailwind CSS 4, Socket.IO for signaling, and native WebRTC API for video calling. All users who visit the site automatically join a single shared conference room.

## Development Commands

### Local Development
```bash
# Start development server with Socket.IO and HTTPS (runs on https://localhost:4057)
npm run dev

# Build for production
npm run build

# Start production server (must build first)
npm run start

# Run linter
npm run lint
```

### Docker Deployment
```bash
# Build Docker image
npm run docker:build

# Start container in background
npm run docker:up

# Stop container
npm run docker:down

# View logs
npm run docker:logs

# Restart container
npm run docker:restart

# Rebuild and restart
npm run docker:rebuild
```

**Note:** The project uses a custom HTTPS server (`server.js`) that runs both Next.js and Socket.IO server together on port 4057 with SSL encryption. Can be deployed via Docker for production use.

## Architecture

### App Router Structure

This project uses Next.js App Router (app directory) rather than Pages Router:
- `app/layout.tsx` - Root layout component that wraps all pages, includes font configuration (Geist Sans and Geist Mono)
- `app/page.tsx` - Home page component
- `app/globals.css` - Global styles with Tailwind CSS 4 and CSS custom properties for theming

### Styling

Uses Tailwind CSS 4 with the new inline theme syntax:
- Tailwind is imported via `@import "tailwindcss"` in globals.css
- Theme configuration uses `@theme inline` blocks with CSS custom properties
- Dark mode is handled via `prefers-color-scheme` media query
- Custom CSS properties: `--background`, `--foreground`, `--font-sans`, `--font-mono`

### TypeScript Configuration

- Module resolution: `bundler`
- Path alias: `@/*` maps to project root
- Strict mode enabled
- Target: ES2017
- JSX mode: `react-jsx` (React 19 new JSX transform)

### WebRTC Video Conferencing

Uses **Socket.IO** for signaling and **native WebRTC API** for mesh-topology video conferencing:
- `server.js` - Custom Node.js server running Next.js + Socket.IO for WebRTC signaling
- `app/videocall/page.tsx` - Video conference page
- `app/components/VideoCall.tsx` - Main WebRTC component with Socket.IO signaling logic
- `app/components/MediaControls.tsx` - Audio/video controls component

**How it works:**
1. User opens the video call page and automatically connects to Socket.IO server
2. Socket.IO notifies the user about all existing participants
3. User creates WebRTC peer connections with each existing participant
4. When new users join, all participants automatically create connections with them
5. Video/audio streams are sent directly P2P between all browsers (mesh topology)
6. No IDs to share - everyone who visits the site joins the same conference

**Architecture:**
- **Signaling:** Socket.IO handles WebRTC offer/answer/ICE candidate exchange
- **Media:** Direct P2P connections between all participants (mesh topology)
- **Auto-join:** No room codes or IDs needed - single global conference room

**Important:** WebRTC requires HTTPS for camera/microphone access on mobile devices. The server uses self-signed SSL certificates.

**Network Access:**
- Local: `https://localhost:4057`
- LAN: `https://192.168.50.57:4057`
- Internet (via DMZ): `https://176.36.188.208:4057` - port 4057 is forwarded through DMZ

**SSL Certificates:**
- Self-signed certificates are in `ssl/` directory
- Browsers will show security warning - this is normal for self-signed certs
- See `MOBILE_SETUP.md` for instructions on accepting certificates on mobile devices

## Key Technical Details

- **Next.js Version**: 16.0.3 (latest)
- **React Version**: 19.2.0 (includes new features like Actions, useActionState)
- **Tailwind CSS**: v4 (uses new PostCSS plugin architecture via `@tailwindcss/postcss`)
- **ESLint**: v9 with Next.js config (uses new flat config format in `eslint.config.mjs`)
- **Socket.IO**: v4.8.1 for WebRTC signaling server
- **Custom HTTPS Server**: `server.js` combines Next.js and Socket.IO with SSL
- **Port**: 4057 (configurable via PORT environment variable)
- **SSL**: Self-signed certificates for HTTPS (required for mobile WebRTC)
- Uses native WebRTC API (RTCPeerConnection) instead of libraries like PeerJS

## Notes

- This project uses React 19's JSX runtime (`react-jsx`), not the legacy `preserve` mode
- Tailwind v4 doesn't use a traditional config file - styling is configured via CSS and `@theme` blocks
- Font optimization is handled via `next/font/google` for Geist fonts
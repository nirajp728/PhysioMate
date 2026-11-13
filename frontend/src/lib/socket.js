import { io } from 'socket.io-client'
import { API_URL } from './config'
import { renewSession } from './api'

// One authenticated connection. withCredentials sends the httpOnly login cookie with the handshake;
// the server checks it. If the cookie has expired the connection is refused: renew it and let Socket.IO retry.
export function connectSocket() {
  const s = io(API_URL, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 3000,
  })
  s.on('connect_error', () => { renewSession().catch(() => {}) })
  return s
}
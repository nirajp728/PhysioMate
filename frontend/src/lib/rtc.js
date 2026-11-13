import api from './api'

// Live data goes straight from the patient's browser to each physiotherapist's browser (WebRTC data channel).
// The server only passes the set-up messages (offer, answer, network candidates) and checks who may watch whom.

// ICE servers come from the backend (/api/rtc/ice): free STUN, plus our own TURN relay when the server has one.
// TURN credentials are made per request and expire, so they are fetched again before they run out.
// A relay is only used when a direct link is impossible (mobile carrier NAT, strict firewalls); the data stays DTLS-encrypted.
const FALLBACK = [{ urls: 'stun:stun.l.google.com:19302' }]
let cached = null // { list, until }
async function iceServers() {
  if (cached && cached.until > Date.now()) return cached.list
  try {
    const { data } = await api.get('/rtc/ice')
    cached = { list: data.ice_servers, until: Date.now() + Math.max(60, data.ttl - 300) * 1000 }
    return cached.list
  } catch {
    return FALLBACK
  }
}

const MAX_VIEWERS = 5 // a patient's browser never serves more than this many physiotherapists

// Messages are handled one at a time, in the order they arrive (a candidate must not overtake an offer).
function inOrder(fn) {
  let chain = Promise.resolve()
  return (msg) => { chain = chain.then(() => fn(msg)).catch(() => {}) }
}

// Patient side: answer every physiotherapist who calls, and send live values to all open channels.
export function servePatient(socket) {
  const peers = new Map() // physiotherapist socket id -> { pc, ch }
  const drop = (id) => { peers.get(id)?.pc.close(); peers.delete(id) }

  const onSignal = inOrder(async ({ from, data }) => {
    if (data.sdp?.type === 'offer') {
      if (peers.size >= MAX_VIEWERS && !peers.has(from)) return
      drop(from) // a new offer means that viewer is starting again
      const pc = new RTCPeerConnection({ iceServers: await iceServers() })
      const peer = { pc, ch: null }
      peers.set(from, peer)
      pc.onicecandidate = (e) => e.candidate && socket.emit('rtc_signal', { to: from, data: { ice: e.candidate } })
      pc.ondatachannel = (e) => { peer.ch = e.channel }
      pc.onconnectionstatechange = () => {
        if (['failed', 'closed'].includes(pc.connectionState) && peers.get(from) === peer) drop(from)
      }
      await pc.setRemoteDescription(data.sdp)
      await pc.setLocalDescription(await pc.createAnswer())
      socket.emit('rtc_signal', { to: from, data: { sdp: pc.localDescription } })
    } else if (data.ice && peers.has(from)) {
      await peers.get(from).pc.addIceCandidate(data.ice)
    }
  })
  socket.on('rtc_signal', onSignal)
  const onRevoke = ({ from }) => drop(from) // the server says this physiotherapist is no longer allowed
  socket.on('rtc_revoke', onRevoke)

  return {
    viewers: () => [...peers.values()].filter((p) => p.ch?.readyState === 'open').length,
    send(msg) {
      const open = [...peers.values()].filter((p) => p.ch?.readyState === 'open' && p.ch.bufferedAmount < 65536)
      if (!open.length) return
      const text = JSON.stringify(msg)
      open.forEach((p) => p.ch.send(text))
    },
    close() {
      socket.off('rtc_signal', onSignal)
      socket.off('rtc_revoke', onRevoke)
      ;[...peers.keys()].forEach(drop)
    },
  }
}

// Physiotherapist side: call the patient. onState gets 'connecting' | 'connected' | 'failed' ...
// Returns a function that closes the link.
export function watchPatient(socket, patientId, onMessage, onState) {
  let pc = null
  let closed = false
  let giveUp = null
  let onSignal = null
  onState('connecting')

  iceServers().then(async (servers) => {
    if (closed) return
    pc = new RTCPeerConnection({ iceServers: servers })
    // Live values: a late packet is useless, so no ordering and no resending.
    const ch = pc.createDataChannel('live', { ordered: false, maxRetransmits: 0 })
    ch.onmessage = (e) => onMessage(JSON.parse(e.data))
    pc.onicecandidate = (e) => e.candidate && socket.emit('rtc_signal', { patient_id: patientId, data: { ice: e.candidate } })
    pc.onconnectionstatechange = () => onState(pc.connectionState)
    giveUp = setTimeout(() => pc.connectionState !== 'connected' && onState('failed'), 10000)

    onSignal = inOrder(async ({ data }) => {
      if (data.sdp) await pc.setRemoteDescription(data.sdp)
      else if (data.ice) await pc.addIceCandidate(data.ice)
    })
    socket.on('rtc_signal', onSignal)

    await pc.setLocalDescription(await pc.createOffer())
    socket.emit('rtc_signal', { patient_id: patientId, data: { sdp: pc.localDescription } })
  })

  return () => {
    closed = true
    clearTimeout(giveUp)
    if (onSignal) socket.off('rtc_signal', onSignal)
    pc?.close()
  }
}
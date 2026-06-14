import type { Socket } from 'socket.io-client'

export type SocketErrorPayload = {
  code: string
}

type SocketStatus = 'connecting' | 'connected' | 'joined' | 'error' | 'disconnected'

/**
 * Handle a domain `:error` event from the websocket server.
 * Auth/session loss → re-join; other codes → surface a readable message.
 */
export function handleSocketDomainError(
  socket: Socket,
  documentId: string,
  payload: SocketErrorPayload,
  setStatus: (status: SocketStatus) => void,
  setStatusMessage: (message: string) => void,
): void {
  const code = payload?.code ?? 'UNKNOWN'

  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
    setStatus('connected')
    setStatusMessage('Reconnecting to document...')
    socket.emit('document:join', documentId)
    return
  }

  setStatusMessage(`Action failed (${code})`)
}

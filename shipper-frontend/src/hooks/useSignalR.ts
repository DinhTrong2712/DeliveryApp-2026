import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../stores/authStore'

type EventHandlers = Record<string, (...args: unknown[]) => void>

export function useSignalR(handlers: EventHandlers, groups?: string[]) {
  const { token, user } = useAuthStore()
  const connRef = useRef<signalR.HubConnection | null>(null)

  useEffect(() => {
    if (!token) return

    const conn = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/delivery', { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build()

    Object.entries(handlers).forEach(([event, handler]) => {
      conn.on(event, handler)
    })

    conn.start().then(async () => {
      if (groups?.includes('accountants')) await conn.invoke('JoinAccountantGroup')
      if (groups?.includes('shipper') && user?.id) await conn.invoke('JoinShipperGroup', user.id)
    })

    connRef.current = conn
    return () => { conn.stop() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return connRef
}

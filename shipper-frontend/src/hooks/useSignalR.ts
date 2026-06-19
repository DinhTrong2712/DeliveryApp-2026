import { useEffect, useRef } from 'react'
import * as signalR from '@microsoft/signalr'
import { useAuthStore } from '../stores/authStore'

type EventHandlers = Record<string, (...args: unknown[]) => void>

export function useSignalR(handlers: EventHandlers, groups?: string[]) {
  const { token, user } = useAuthStore()
  const connRef = useRef<signalR.HubConnection | null>(null)
  const handlersRef = useRef(handlers)
  const groupsRef = useRef(groups)
  const userIdRef = useRef(user?.id)

  // Update refs when values change
  useEffect(() => {
    handlersRef.current = handlers
    groupsRef.current = groups
    userIdRef.current = user?.id
  }, [handlers, groups, user?.id])

  useEffect(() => {
    if (!token) return

    const conn = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/delivery', { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build()

    // Register handlers using ref to always get latest handlers
    Object.entries(handlers).forEach(([event]) => {
      conn.on(event, (...args: unknown[]) => {
        // Use latest handlers from ref
        const latestHandler = handlersRef.current[event]
        if (latestHandler) latestHandler(...args)
      })
    })

    conn.start().then(async () => {
      const currentGroups = groupsRef.current
      const currentUserId = userIdRef.current
      if (currentGroups?.includes('accountants')) await conn.invoke('JoinAccountantGroup')
      if (currentGroups?.includes('shipper') && currentUserId) await conn.invoke('JoinShipperGroup', currentUserId)
    }).catch(err => {
      console.error('SignalR connection failed:', err)
    })

    connRef.current = conn

    return () => {
      if (conn.state === signalR.HubConnectionState.Connected) {
        conn.stop().catch(err => console.error('SignalR disconnect error:', err))
      }
    }
  }, [token])

  return connRef
}

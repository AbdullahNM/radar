// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VersionInfo } from '../../api/client'

vi.mock('../../api/client', () => ({
  useCapabilities: () => ({ data: { deployment: { mode: 'local' } } }),
  useVersionCheck: () => ({ data: { currentVersion: '1.2.3', updateAvailable: false, installMethod: 'desktop' } }),
  useStartDesktopUpdate: () => ({ mutate: vi.fn(), isPending: false }),
  useDesktopUpdateStatus: () => ({ data: undefined }),
  useApplyDesktopUpdate: () => ({ mutate: vi.fn() }),
}))
vi.mock('./Toast', () => ({ showApiError: vi.fn(), showApiSuccess: vi.fn(), showApiNotice: vi.fn() }))

import { UpdateNotification } from './UpdateNotification'
import { showApiError, showApiNotice, showApiSuccess } from './Toast'
import { setApiBase } from '../../api/config'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root
let container: HTMLDivElement
let client: QueryClient
const current: VersionInfo = { currentVersion: '1.2.3', updateAvailable: false, installMethod: 'desktop' }

beforeEach(() => {
  vi.clearAllMocks()
  setApiBase('/desktop/api')
  client = new QueryClient()
  client.setQueryData(['version-check', '/desktop/api'], current)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <QueryClientProvider client={client}>
      <UpdateNotification />
      <UpdateNotification placement="settings" />
    </QueryClientProvider>,
  ))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  client.clear()
  setApiBase('/api')
})

describe('manual Desktop version checks', () => {
  it('acknowledges one check even when Settings is also mounted', () => {
    act(() => { window.dispatchEvent(new Event('radar:check-for-updates')) })
    expect(showApiNotice).toHaveBeenCalledExactlyOnceWith('Checking for updates…', undefined, 'info')
  })

  it('reports an up-to-date result once', () => {
    act(() => { window.dispatchEvent(new CustomEvent('radar:update-check-result', { detail: current })) })
    expect(showApiSuccess).toHaveBeenCalledExactlyOnceWith("You're up to date", 'Radar 1.2.3')
  })

  it('publishes a fresh available update and clears its dismissal', () => {
    localStorage.setItem('radar-update-dismissed', '1.3.0')
    const info = { ...current, updateAvailable: true, latestVersion: '1.3.0' }
    act(() => { window.dispatchEvent(new CustomEvent('radar:update-check-result', { detail: info })) })
    expect(client.getQueryData(['version-check', '/desktop/api'])).toEqual(info)
    expect(localStorage.getItem('radar-update-dismissed')).toBeNull()
    expect(showApiNotice).toHaveBeenCalledExactlyOnceWith('Radar 1.3.0 is available', undefined, 'info')
  })

  it('reports failure without replacing known version data', () => {
    act(() => { window.dispatchEvent(new CustomEvent('radar:update-check-result', { detail: { ...current, error: 'offline' } })) })
    expect(showApiError).toHaveBeenCalledExactlyOnceWith('Could not check for updates', 'offline')
    expect(showApiSuccess).not.toHaveBeenCalled()
    expect(client.getQueryData(['version-check', '/desktop/api'])).toEqual(current)
  })

  it('does not claim a development build is up to date', () => {
    act(() => { window.dispatchEvent(new CustomEvent('radar:update-check-result', { detail: { ...current, currentVersion: '1.3.0-37-g8b325b372', buildChannel: 'development', latestVersion: '1.3.0' } })) })
    expect(showApiSuccess).not.toHaveBeenCalled()
    expect(showApiNotice).toHaveBeenCalledWith('Latest Radar release: 1.3.0', 'You are running a development build.', 'info')
  })

  it('discards an automatic response that races with the manual result', async () => {
    let resolveAutomatic!: (value: VersionInfo) => void
    const pending = client.fetchQuery({
      queryKey: ['version-check', '/desktop/api'],
      queryFn: () => new Promise<VersionInfo>(resolve => { resolveAutomatic = resolve }),
      staleTime: 0,
    }).catch(() => undefined)
    const info = { ...current, updateAvailable: true, latestVersion: '1.3.0' }
    act(() => { window.dispatchEvent(new CustomEvent('radar:update-check-result', { detail: info })) })
    resolveAutomatic(current)
    await pending
    expect(client.getQueryData(['version-check', '/desktop/api'])).toEqual(info)
  })
})

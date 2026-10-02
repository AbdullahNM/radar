// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HelmValues } from '../../types'
import { ValuesViewer } from './ValuesViewer'

const mutations = vi.hoisted(() => ({
  apply: vi.fn(async () => undefined),
  preview: vi.fn(async () => undefined),
}))

vi.mock('@skyhook-io/k8s-ui', () => ({
  PaneLoader: ({ label }: { label: string }) => <div>{label}</div>,
}))
vi.mock('../../api/client', () => ({
  useCanHelmAct: () => ({ allowed: true }),
  useHelmApplyValues: () => ({
    mutateAsync: mutations.apply,
    isPending: false,
    error: null,
  }),
  useHelmPreviewValues: () => ({
    mutateAsync: mutations.preview,
    isPending: false,
    error: null,
  }),
}))
vi.mock('../ui/CodeViewer', () => ({
  CodeViewer: ({ code }: { code: string }) => (
    <pre data-testid="values-code">{code}</pre>
  ),
}))
vi.mock('../ui/YamlEditor', () => ({
  YamlEditor: ({ value }: { value: string }) => (
    <textarea aria-label="User Overrides YAML" value={value} readOnly />
  ),
}))
vi.mock('./ValuesDiffPreview', () => ({ ValuesDiffPreview: () => null }))
vi.mock('../ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
}))

const values: HelmValues = {
  userSupplied: { image: { tag: 'pinned' } },
  computed: {
    image: { repository: 'example/app', tag: 'pinned' },
    replicaCount: 2,
  },
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root

beforeEach(() => {
  mutations.apply.mockClear()
  mutations.preview.mockClear()
  const element = document.createElement('div')
  document.body.appendChild(element)
  root = createRoot(element)
})

afterEach(async () => {
  await act(async () => root.unmount())
  document.body.replaceChildren()
})

function Harness() {
  const [showEffectiveValues, setShowEffectiveValues] = useState(true)
  return (
    <ValuesViewer
      values={values}
      isLoading={false}
      showEffectiveValues={showEffectiveValues}
      onToggleEffectiveValues={setShowEffectiveValues}
      onCopy={() => undefined}
      copied={false}
      namespace="demo"
      name="example"
    />
  )
}

async function renderViewer() {
  await act(async () => root.render(<Harness />))
}

function button(label: string) {
  return Array.from(document.querySelectorAll('button')).find(
    (element) => element.textContent?.trim() === label,
  )
}

describe('ValuesViewer', () => {
  it('shows read-only effective values by default and switches to user overrides', async () => {
    await renderViewer()

    expect(document.body.textContent).toContain('Effective Values')
    expect(
      document.querySelector('[data-testid="values-code"]')?.textContent,
    ).toContain('replicaCount: 2')
    expect(document.querySelector('textarea')).toBeNull()

    await act(async () => button('User Overrides')!.click())

    expect(document.body.textContent).toContain('User Overrides')
    expect(
      document.querySelector('[data-testid="values-code"]')?.textContent,
    ).toContain('tag: pinned')
    expect(
      document.querySelector('[data-testid="values-code"]')?.textContent,
    ).not.toContain('replicaCount')
  })

  it('labels editing explicitly and applies only user overrides', async () => {
    await renderViewer()

    await act(async () => button('Edit Overrides')!.click())

    expect(document.body.textContent).toContain('Editing User Overrides')
    expect(
      (document.querySelector('textarea') as HTMLTextAreaElement).value,
    ).toContain('tag: pinned')
    expect(
      (document.querySelector('textarea') as HTMLTextAreaElement).value,
    ).not.toContain('replicaCount')

    await act(async () => button('Apply')!.click())

    expect(mutations.apply).toHaveBeenCalledWith({
      namespace: 'demo',
      name: 'example',
      values: { image: { tag: 'pinned' } },
    })
  })
})

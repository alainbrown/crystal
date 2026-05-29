// Minimal `chrome.*` shim so the extension modules (store, settings,
// worker-client) load and run under Remotion's plain-browser environment.
// The demo never actually connects a port or persists settings — it drives the
// Zustand store directly — so these are inert no-ops.

const noop = () => {}

const shim = {
  runtime: {
    connect: () => ({
      name: 'crystal-llm',
      onMessage: { addListener: noop, removeListener: noop },
      onDisconnect: { addListener: noop, removeListener: noop },
      postMessage: noop,
      disconnect: noop,
    }),
    openOptionsPage: noop,
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => {},
    },
    onChanged: { addListener: noop, removeListener: noop },
  },
}

if (typeof (globalThis as { chrome?: unknown }).chrome === 'undefined') {
  ;(globalThis as { chrome?: unknown }).chrome = shim
}

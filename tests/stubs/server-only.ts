// The real `server-only` package throws when loaded outside a server
// component. Vitest runs plain Node, so it is aliased to this no-op —
// the guard still protects the actual build.
export {};

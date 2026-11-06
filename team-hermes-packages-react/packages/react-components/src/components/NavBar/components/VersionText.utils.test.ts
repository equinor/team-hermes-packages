import { describe, expect, it } from 'vite-plus/test'

import { parseVersionFile } from '@/components/NavBar/components/VersionText.utils'

describe('parseVersionFile', () => {
  it('parses the generated version file', () => {
    expect(parseVersionFile('hash: abc123\ndate: 2026-11-05\nrefs: v1.2.3\n')).toEqual({
      hash: 'abc123',
      date: '2026-11-05',
      refs: 'v1.2.3',
    })
  })

  it('trims CRLF and whitespace, preserves colons, and ignores malformed or unknown lines', () => {
    expect(
      parseVersionFile(
        '\r\n hash : abc123 \r\nbad line\r\n: ignored\r\nunknown: ignored\r\n date: 09: 42 \r\nrefs: tag: v1: release\r\n'
      )
    ).toEqual({ hash: 'abc123', date: '09: 42', refs: 'tag: v1: release' })
  })

  it('allows missing optional fields and empty refs', () => {
    expect(parseVersionFile('hash:abc123\nrefs: ')).toEqual({ hash: 'abc123', date: '', refs: '' })
  })

  it.each([
    '',
    '\nmalformed\n',
    'hash: \ndate: today',
    'refs: main',
    '<!doctype html><html><body>hash: abc123</body></html>',
    '<HTML>\nhash: abc123\n</HTML>',
  ])('rejects invalid version data: %j', (text) => {
    expect(parseVersionFile(text)).toBeNull()
  })
})

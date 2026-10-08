import { describe, it, expect } from 'vitest'
import { renderChatMarkdown } from '@/utils/chat-markdown'

describe('renderChatMarkdown', () => {
  it('wraps paragraphs and joins lines inside one with a break', () => {
    expect(renderChatMarkdown('First line\nsecond line\n\nNext paragraph')).toBe('<p>First line<br>second line</p><p>Next paragraph</p>')
  })
  it('renders numbered and bulleted lists', () => {
    expect(renderChatMarkdown('Do this:\n1. One\n2. Two\n\n- a\n* b')).toBe('<p>Do this:</p><ol><li>One</li><li>Two</li></ol><ul><li>a</li><li>b</li></ul>')
  })
  it('renders bold, inline code and markdown links that open in a new tab', () => {
    expect(renderChatMarkdown('Use **the puller** and `1225` from [Moen](https://moen.com/a?b=1&c=2)')).toBe(
      '<p>Use <strong>the puller</strong> and <code>1225</code> from <a href="https://moen.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">Moen</a></p>',
    )
  })
  it('links bare web addresses once and leaves other schemes alone', () => {
    expect(renderChatMarkdown('See https://moen.com/x. Not javascript:alert(1)')).toBe(
      '<p>See <a href="https://moen.com/x" target="_blank" rel="noopener noreferrer">https://moen.com/x</a>. Not javascript:alert(1)</p>',
    )
    expect(renderChatMarkdown('[bad](javascript:alert(1))')).toBe('<p>[bad](javascript:alert(1))</p>')
  })
  it('escapes HTML before anything else', () => {
    expect(renderChatMarkdown('<script>alert(1)</script> **<b>x</b>** `<i>`')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; <strong>&lt;b&gt;x&lt;/b&gt;</strong> <code>&lt;i&gt;</code></p>',
    )
    // A quote breaks the link syntax, and a bare address only links after whitespace, so nothing here becomes an attribute.
    expect(renderChatMarkdown('[x](https://a.b" onclick="alert(1))')).toBe('<p>[x](https://a.b&quot; onclick=&quot;alert(1))</p>')
  })
  it('renders headings as bold text and images as their alt text', () => {
    expect(renderChatMarkdown('## Steps\n![a photo](https://x.y/p.png)')).toBe('<p><strong>Steps</strong><br>a photo</p>')
  })
  it('returns an empty string for blank input', () => {
    expect(renderChatMarkdown('  \n ')).toBe('')
  })
})

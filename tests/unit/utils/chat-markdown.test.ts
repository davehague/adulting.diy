import { describe, it, expect } from 'vitest'
import { renderChatMarkdown } from '@/utils/chat-markdown'

describe('renderChatMarkdown', () => {
  it('wraps paragraphs and joins lines inside one with a break', () => {
    expect(renderChatMarkdown('First line\nsecond line\n\nNext paragraph')).toBe('<p>First line<br>second line</p><p>Next paragraph</p>')
  })
  it('renders numbered and bulleted lists', () => {
    expect(renderChatMarkdown('Do this:\n1. One\n2. Two\n\n- a\n* b')).toBe('<p>Do this:</p><ol><li>One</li><li>Two</li></ol><ul><li>a</li><li>b</li></ul>')
  })
  it('keeps the numbering of an ordered list that a bullet interrupts, and of one that starts above 1', () => {
    expect(renderChatMarkdown('1. One\n- note\n2. Two')).toBe('<ol><li>One</li></ol><ul><li>note</li></ul><ol start="2"><li>Two</li></ol>')
    expect(renderChatMarkdown('3. Three\n4. Four')).toBe('<ol start="3"><li>Three</li><li>Four</li></ol>')
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
    // The space ends the address, so the link pattern finds no closing bracket after it; the bare-address pass needs the start of the text or whitespace before https, and here a bracket precedes it. Nothing becomes an attribute.
    expect(renderChatMarkdown('[x](https://a.b" onclick="alert(1))')).toBe('<p>[x](https://a.b&quot; onclick=&quot;alert(1))</p>')
    // With no space the escaped quote is an ordinary address character, so a link is made, but the quote stays inside the double-quoted href and can never close it.
    const html = renderChatMarkdown('[x](https://a.b"onclick=alert(1))')
    expect(html).toBe('<p><a href="https://a.b&quot;onclick=alert(1" target="_blank" rel="noopener noreferrer">x</a>)</p>')
    expect(html).not.toMatch(/<a [^>]*\sonclick=/)
  })
  it('strips NUL bytes so model text cannot collide with the placeholder marker', () => {
    expect(renderChatMarkdown('a\u0000b **c**')).toBe('<p>ab <strong>c</strong></p>')
    expect(renderChatMarkdown('x \u00000\u0000 [l](https://a.b)')).toBe('<p>x 0 <a href="https://a.b" target="_blank" rel="noopener noreferrer">l</a></p>')
  })
  it('keeps an address inside a code span literal', () => {
    expect(renderChatMarkdown('`https://a.b/x`')).toBe('<p><code>https://a.b/x</code></p>')
    expect(renderChatMarkdown('`[a](https://b.c)`')).toBe('<p><code>[a](https://b.c)</code></p>')
  })
  it('accepts CRLF line endings', () => {
    expect(renderChatMarkdown('1. One\r\n2. Two')).toBe('<ol><li>One</li><li>Two</li></ol>')
    expect(renderChatMarkdown('First\r\nsecond\r\n\r\nNext')).toBe('<p>First<br>second</p><p>Next</p>')
  })
  it('renders headings as bold text and images as their alt text', () => {
    expect(renderChatMarkdown('## Steps\n![a photo](https://x.y/p.png)')).toBe('<p><strong>Steps</strong><br>a photo</p>')
  })
  it('returns an empty string for blank input', () => {
    expect(renderChatMarkdown('  \n ')).toBe('')
  })
})

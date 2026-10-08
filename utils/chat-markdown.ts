// A small renderer for model replies: paragraphs, numbered and bulleted lists, bold, inline code and links. Everything is escaped first; headings become bold text and images their alt text. No raw HTML ever passes through.

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const anchor = (href: string, label: string): string => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;

// Code spans and links are built on already-escaped text and parked in placeholders so no later pass can touch them: an address inside a code span stays literal and a link is not linked twice. The marker is a NUL, which is stripped from the model's text first and kept out of every pattern that parks, so the text can never collide with it.
const inline = (raw: string): string => {
  const parked: string[] = [];
  const park = (html: string): string => {
    parked.push(html);
    return `\u0000${parked.length - 1}\u0000`;
  };
  let text = escapeHtml(raw.replace(/\u0000/g, ''));
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/`([^`]+)`/g, (_match, code: string) => park(`<code>${code}</code>`));
  text = text.replace(/\[([^\]\u0000]+)\]\((https?:\/\/[^\s)\u0000]+)\)/g, (_match, label: string, href: string) => park(anchor(href, label)));
  text = text.replace(/(^|\s)(https?:\/\/[^\s<\u0000]+?)([.,;:!?)]*)(?=\s|$)/g, (_match, before: string, href: string, trailing: string) => `${before}${park(anchor(href, href))}${trailing}`);
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return text.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => parked[Number(index)]);
};

const ORDERED = /^\s*(\d+)[.)]\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

// An ordered block remembers its first number, so a list the model interrupts keeps counting.
type Block = { kind: 'p'; lines: string[] } | { kind: 'ol'; start: number; items: string[] } | { kind: 'ul'; items: string[] };

const toBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  const last = (): Block | undefined => blocks[blocks.length - 1];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) {
      if (last() && last()?.kind === 'p') blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const ordered = ORDERED.exec(line);
    const bullet = BULLET.exec(line);
    if (ordered) {
      const current = last();
      if (current && current.kind === 'ol') current.items.push(ordered[2]);
      else blocks.push({ kind: 'ol', start: Number(ordered[1]), items: [ordered[2]] });
      continue;
    }
    if (bullet) {
      const current = last();
      if (current && current.kind === 'ul') current.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
      continue;
    }
    const heading = HEADING.exec(line);
    const content = heading ? `**${heading[1]}**` : line.trim();
    const current = last();
    if (current && current.kind === 'p') current.lines.push(content);
    else blocks.push({ kind: 'p', lines: [content] });
  }
  return blocks;
};

export const renderChatMarkdown = (text: string): string =>
  toBlocks(text)
    .map((block) => {
      if (block.kind === 'p') return block.lines.length > 0 ? `<p>${block.lines.map(inline).join('<br>')}</p>` : '';
      const items = block.items.map((item) => `<li>${inline(item)}</li>`).join('');
      if (block.kind === 'ul') return `<ul>${items}</ul>`;
      return block.start === 1 ? `<ol>${items}</ol>` : `<ol start="${block.start}">${items}</ol>`;
    })
    .join('');

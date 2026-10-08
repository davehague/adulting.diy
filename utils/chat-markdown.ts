// A small renderer for model replies: paragraphs, numbered and bulleted lists, bold, inline code and links. Everything is escaped first; headings become bold text and images their alt text. No raw HTML ever passes through.

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const anchor = (href: string, label: string): string => `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;

// Links are built on already-escaped text and parked in placeholders so the bare-address pass cannot link them twice.
const inline = (raw: string): string => {
  const parked: string[] = [];
  const park = (html: string): string => {
    parked.push(html);
    return `\u0000${parked.length - 1}\u0000`;
  };
  let text = escapeHtml(raw);
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, href: string) => park(anchor(href, label)));
  text = text.replace(/(^|\s)(https?:\/\/[^\s<]+?)([.,;:!?)]*)(?=\s|$)/g, (_match, before: string, href: string, trailing: string) => `${before}${park(anchor(href, href))}${trailing}`);
  text = text.replace(/`([^`]+)`/g, (_match, code: string) => park(`<code>${code}</code>`));
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return text.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => parked[Number(index)]);
};

const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
const BULLET = /^\s*[-*•]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

type Block = { kind: 'p'; lines: string[] } | { kind: 'ol' | 'ul'; items: string[] };

const toBlocks = (text: string): Block[] => {
  const blocks: Block[] = [];
  const last = (): Block | undefined => blocks[blocks.length - 1];
  for (const line of text.split('\n')) {
    if (!line.trim()) {
      if (last() && last()?.kind === 'p') blocks.push({ kind: 'p', lines: [] });
      continue;
    }
    const ordered = ORDERED.exec(line);
    const bullet = BULLET.exec(line);
    if (ordered || bullet) {
      const kind = ordered ? 'ol' : 'ul';
      const item = (ordered ?? bullet)?.[1] ?? '';
      const current = last();
      if (current && current.kind === kind) current.items.push(item);
      else blocks.push({ kind, items: [item] });
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
      return `<${block.kind}>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</${block.kind}>`;
    })
    .join('');

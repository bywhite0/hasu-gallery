import type { ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { useI18n } from '../i18n';

const inlineTokenPattern = /(\{\{media:[^}]+\}\}|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|\*[^*\n]+\*)/g;

function renderInline(source: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  inlineTokenPattern.lastIndex = 0;
  while ((match = inlineTokenPattern.exec(source)) !== null) {
    if (match.index > cursor) {
      nodes.push(source.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;
    if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[')) {
      const labelEnd = token.indexOf('](');
      const label = token.slice(1, labelEnd);
      const href = token.slice(labelEnd + 2, -1);
      nodes.push(
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-info underline decoration-info/40 underline-offset-4 hover:decoration-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          {label}
        </a>,
      );
    } else {
      nodes.push(<MediaPlaceholder key={key} />);
    }

    cursor = match.index + token.length;
  }

  if (cursor < source.length) {
    nodes.push(source.slice(cursor));
  }

  return nodes;
}

function MediaPlaceholder() {
  const { t } = useI18n();

  return (
    <span className="my-4 flex min-h-24 items-center justify-center gap-2 rounded-md border border-dashed border-ink/20 bg-surface px-4 py-6 font-sans text-sm text-ink-2" role="note">
      <ImageOff className="h-5 w-5 shrink-0" aria-hidden="true" />
      {t('fiction.mediaUnavailable')}
    </span>
  );
}

function renderParagraph(paragraph: string, paragraphIndex: number) {
  const lines = paragraph.split('\n');
  const content: ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    const hasExplicitBreak = line.endsWith('\\');
    const normalized = hasExplicitBreak ? line.slice(0, -1) : line;
    content.push(...renderInline(normalized, `${paragraphIndex}-${lineIndex}`));

    if (lineIndex < lines.length - 1) {
      content.push(hasExplicitBreak ? <br key={`br-${paragraphIndex}-${lineIndex}`} /> : ' ');
    }
  });

  return content;
}

export function FictionBody({ body }: { body: string }) {
  const paragraphs = body
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6 text-[1.075rem] leading-8 text-ink sm:text-lg sm:leading-9">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className="whitespace-normal">
          {renderParagraph(paragraph, index)}
        </p>
      ))}
    </div>
  );
}

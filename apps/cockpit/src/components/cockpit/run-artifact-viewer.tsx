import type { ArtifactMediaRef, ArtifactV1 } from '@portarium/cockpit-types';
import { Download, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface RunArtifactViewerProps {
  artifact: ArtifactV1;
  markdown: string;
  className?: string;
}

type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; text: string }
  | { kind: 'media'; alt: string; url: string };

const IMAGE_PATTERN = /^!\[(?<alt>[^\]]*)\]\((?<url>[^)]+)\)$/;

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  }

  function flushList() {
    if (list.length > 0) {
      blocks.push({ kind: 'list', items: list });
      list = [];
    }
  }

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (code === null) {
        flushParagraph();
        flushList();
        code = [];
      } else {
        blocks.push({ kind: 'code', text: code.join('\n') });
        code = null;
      }
      continue;
    }

    if (code !== null) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const image = IMAGE_PATTERN.exec(trimmed);
    if (image?.groups) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'media', alt: image.groups.alt ?? '', url: image.groups.url ?? '' });
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      flushList();
      const marker = heading[1] ?? '#';
      blocks.push({ kind: 'heading', level: marker.length as 1 | 2 | 3, text: heading[2] ?? '' });
      continue;
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  if (code !== null) blocks.push({ kind: 'code', text: code.join('\n') });
  return blocks;
}

function mediaRefFor(mediaRefs: readonly ArtifactMediaRef[] | undefined, url: string) {
  return mediaRefs?.find((ref) => ref.url === url || ref.url.endsWith(url.replace(/^\.\//, '')));
}

function safeMediaUrl(url: string): string {
  const lower = url.trim().toLowerCase();
  if (lower.startsWith('javascript:')) return '#';
  return url;
}

function MediaBlock({ refInfo, alt }: { refInfo: ArtifactMediaRef; alt: string }) {
  const src = safeMediaUrl(refInfo.url);
  return (
    <figure className="overflow-hidden rounded-md border bg-muted/20">
      {refInfo.type === 'mp4' ? (
        <video className="w-full bg-black" controls preload="metadata" aria-label={alt}>
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <img className="w-full object-contain" src={src} alt={alt} />
      )}
      <figcaption className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-[10px] uppercase">
          {refInfo.type}
        </Badge>
        <span className="font-mono">sha256:{refInfo.sha256.slice(0, 12)}</span>
      </figcaption>
    </figure>
  );
}

export function RunArtifactViewer({ artifact, markdown, className }: RunArtifactViewerProps) {
  const blocks = parseMarkdown(markdown);

  return (
    <article
      className={cn('min-h-screen bg-background text-foreground', className)}
      data-testid="run-artifact-viewer"
    >
      <header className="border-b bg-card/70 px-4 py-4 md:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">
                {artifact.artifactId}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {artifact.runId}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold leading-tight md:text-2xl">Run Artifact</h1>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 md:px-6">
        {blocks.map((block, index) => {
          if (block.kind === 'heading') {
            const Heading = `h${block.level}` as 'h1' | 'h2' | 'h3';
            return (
              <Heading
                key={index}
                className={cn(
                  'font-semibold leading-tight',
                  block.level === 1 && 'text-2xl',
                  block.level === 2 && 'pt-2 text-lg',
                  block.level === 3 && 'text-base',
                )}
              >
                {block.text}
              </Heading>
            );
          }
          if (block.kind === 'media') {
            const refInfo = mediaRefFor(artifact.mediaRefs, block.url);
            return refInfo ? (
              <MediaBlock key={index} refInfo={refInfo} alt={block.alt || refInfo.type} />
            ) : (
              <p key={index} className="text-sm text-muted-foreground">
                {block.alt}
              </p>
            );
          }
          if (block.kind === 'list') {
            return (
              <ul key={index} className="list-disc space-y-1 pl-5 text-sm leading-6">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          }
          if (block.kind === 'code') {
            return (
              <pre key={index} className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
                <code>{block.text}</code>
              </pre>
            );
          }
          return (
            <p key={index} className="text-sm leading-6 text-muted-foreground">
              {block.text}
            </p>
          );
        })}
      </main>
    </article>
  );
}

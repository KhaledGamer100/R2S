// HTML formatter utilities
// Detects pasted HTML, extracts readable text for comparison,
// and builds structured question/answer views when possible.

export interface QuestionAnswerPair {
  question: string;
  answer: string;
}

export interface ParsedHtmlContent {
  isHtml: boolean;
  plainText: string;
  lines: string[];
  qaPairs: QuestionAnswerPair[];
}


function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isLikelyHtmlContent(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return /<([a-z][\w-]*)(\s[^>]*)?>/i.test(trimmed) && /<\/[a-z][\w-]*>/i.test(trimmed);
}

function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc
    .querySelectorAll('script, style, noscript, template, iframe, object, embed, canvas, svg, meta, link')
    .forEach((node) => node.remove());

  doc.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}

function extractTextViaDom(html: string): string {
  const safeHtml = sanitizeHtml(html);
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '1200px';
  container.style.pointerEvents = 'none';
  container.style.opacity = '0';
  container.style.whiteSpace = 'normal';
  container.innerHTML = safeHtml;
  document.body.appendChild(container);

  let text = '';
  try {
    text = container.innerText || container.textContent || '';
  } finally {
    document.body.removeChild(container);
  }

  return normalizeWhitespace(text);
}

function fallbackExtractText(html: string): string {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(div|p|li|tr|section|article|label|legend|h[1-6])>/gi, '$&\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function getVisibleLinesFromHtml(html: string): string[] {
  const text = typeof document !== 'undefined'
    ? extractTextViaDom(html)
    : fallbackExtractText(html);

  return text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
}

function isQuestionLike(line: string): boolean {
  if (!line) return false;
  const trimmed = line.trim();
  if (/[?؟]\s*$/.test(trimmed)) return true;
  if (/^q\d+[:.)\-\s]/i.test(trimmed)) return true;
  if (/^(question|السؤال)\b/i.test(trimmed)) return true;
  if (/[:：]\s*$/.test(trimmed) && trimmed.split(' ').length <= 12) return true;
  return false;
}

function isShortAnswer(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^(yes|no|n\/a|true|false|none|matched|different)$/i.test(trimmed)) return true;
  return trimmed.split(' ').length <= 10;
}

function buildQuestionAnswerPairs(lines: string[]): QuestionAnswerPair[] {
  const pairs: QuestionAnswerPair[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];

    // Pattern: "Question: Answer"
    const inlinePair = current.match(/^(.{2,120}?)(?:[:：])\s+(.+)$/);
    if (inlinePair && inlinePair[1] && inlinePair[2] && !/^https?:\/\//i.test(current)) {
      pairs.push({
        question: inlinePair[1].trim(),
        answer: inlinePair[2].trim(),
      });
      continue;
    }

    // Pattern: question line followed by one or more short answer lines
    if (isQuestionLike(current)) {
      const answerLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !isQuestionLike(lines[j])) {
        answerLines.push(lines[j]);
        if (answerLines.length >= 3) break;
        if (answerLines.length >= 1 && !isShortAnswer(lines[j])) break;
        j++;
      }

      if (answerLines.length > 0) {
        pairs.push({
          question: current.replace(/[:：]\s*$/, '').trim(),
          answer: answerLines.join(' / ').trim(),
        });
        i = j - 1;
      }
    }
  }

  return pairs;
}

export function parseHtmlContent(input: string): ParsedHtmlContent {
  const isHtml = isLikelyHtmlContent(input);
  if (!isHtml) {
    const plainText = normalizeWhitespace(input);
    const lines = plainText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return { isHtml: false, plainText, lines, qaPairs: [] };
  }

  const lines = getVisibleLinesFromHtml(input);
  const plainText = lines.join('\n');
  const qaPairs = buildQuestionAnswerPairs(lines);

  return {
    isHtml: true,
    plainText,
    lines,
    qaPairs,
  };
}

export function getComparableContent(input: string): string {
  const parsed = parseHtmlContent(input);
  return parsed.plainText || input;
}

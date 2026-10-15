// Checks what lint can't: required stories, the .client.tsx rule and literal colors.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, basename } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'src');

// Next special files that must be Client Components and can't take the suffix.
const NEXT_CLIENT_FILES = new Set(['error.tsx', 'global-error.tsx']);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const isTestOrStory = (file) => /\.(spec|stories)\.tsx?$/.test(file);
const usesClientDirective = (file) =>
  /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8'));

const files = walk(src).filter(
  (file) => file.endsWith('.tsx') && !isTestOrStory(file),
);
const errors = [];

for (const file of files) {
  const rel = relative(root, file);
  const isComponent =
    rel.startsWith('src/components/ui/') ||
    /^src\/features\/[^/]+\/components\//.test(rel);

  if (isComponent && !existsSync(file.replace(/\.tsx$/, '.stories.tsx'))) {
    errors.push(
      `${rel}: falta a story (${basename(file, '.tsx')}.stories.tsx).`,
    );
  }

  const isClientFile = file.endsWith('.client.tsx');
  const hasDirective = usesClientDirective(file);
  const isNextSpecial =
    rel.startsWith('src/app/') && NEXT_CLIENT_FILES.has(basename(file));

  if (hasDirective && !isClientFile && !isNextSpecial) {
    errors.push(
      `${rel}: tem 'use client' mas o nome não termina em .client.tsx.`,
    );
  }
  if (isClientFile && !hasDirective) {
    errors.push(
      `${rel}: termina em .client.tsx mas não começa com 'use client'.`,
    );
  }
}

// Chat UI uses only theme tokens, so both themes stay in sync (THEME-01).
const TOKEN_ONLY_SCOPE =
  /^src\/(features\/chat\/|components\/ui\/(avatar|theme-toggle)[^/]*$)/;
const LITERAL_COLOR_VALUES = [
  /#[0-9a-fA-F]{3,8}\b/,
  /\b(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb|color)\(/,
];

// Every Tailwind v4 utility that takes a color. Longest first, so `ring-offset`
// wins over `ring` and `inset-shadow` over `shadow`.
const COLOR_PREFIXES = [
  'border-[xytrblse]',
  'inset-shadow',
  'inset-ring',
  'drop-shadow',
  'ring-offset',
  'decoration',
  'placeholder',
  'outline',
  'divide',
  'shadow',
  'border',
  'accent',
  'stroke',
  'caret',
  'text',
  'ring',
  'fill',
  'from',
  'via',
  'bg',
  'to',
];
const COLOR_UTILITY = new RegExp(
  `(?:^|[\\s"'\`:!{(,])-?(${COLOR_PREFIXES.join('|')})-(\\[[^\\]]*\\]|[^\\s"'\`}),]+)`,
  'g',
);
const PALETTE =
  /^(slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}$/;
// Bare-word arbitrary values that are not colors (`outline-[none]`).
const NON_COLOR_KEYWORDS = new Set([
  'none',
  'inherit',
  'initial',
  'unset',
  'transparent',
  'currentcolor',
]);

// The allow side: the theme's own colors (`--color-*` in globals.css).
const THEME_COLORS = new Set(
  Array.from(
    readFileSync(join(src, 'app/globals.css'), 'utf8').matchAll(
      /--color-([a-z0-9-]+)\s*:/g,
    ),
    (m) => m[1],
  ),
);

function literalColorUtility(value) {
  if (value.startsWith('[')) {
    const inner = value.slice(1, -1).toLowerCase();
    if (inner.startsWith('color:')) return true;
    return /^[a-z]+$/.test(inner) && !NON_COLOR_KEYWORDS.has(inner);
  }
  const name = value.split('/')[0];
  if (THEME_COLORS.has(name)) return false;
  return PALETTE.test(name) || name === 'white' || name === 'black';
}

function findLiteralColor(content) {
  for (const pattern of LITERAL_COLOR_VALUES) {
    const match = content.match(pattern);
    if (match) return match[0];
  }
  for (const [, prefix, value] of content.matchAll(COLOR_UTILITY)) {
    if (literalColorUtility(value)) return `${prefix}-${value}`;
  }
  return null;
}

const tokenOnlyFiles = walk(src).filter((file) =>
  TOKEN_ONLY_SCOPE.test(relative(root, file)),
);

for (const file of tokenOnlyFiles) {
  const literal = findLiteralColor(readFileSync(file, 'utf8'));
  if (literal) {
    errors.push(
      `${relative(root, file)}: cor literal "${literal}"; use os tokens do tema.`,
    );
  }
}

if (errors.length > 0) {
  console.error(
    `Convenções do web violadas:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
  );
  process.exit(1);
}

console.log(`Convenções OK (${files.length} arquivos verificados).`);

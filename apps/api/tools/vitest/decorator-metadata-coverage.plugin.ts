import MagicString from 'magic-string';
import type { Plugin } from 'vite';

/**
 * emitDecoratorMetadata emits `typeof X === "undefined" ? Object : X`, whose
 * Object branch never runs. Ignores only that generated pattern in coverage.
 */
const GENERATED_METADATA_TERNARY =
  /typeof (\w+) === "undefined" \? Object : \1/g;

export function decoratorMetadataCoveragePlugin(): Plugin {
  return {
    name: 'decorator-metadata-coverage',
    enforce: 'post',
    transform(code, id) {
      if (!id.includes('/src/') || !code.includes('_decorateMetadata')) {
        return null;
      }

      const s = new MagicString(code);
      let changed = false;

      for (const match of code.matchAll(GENERATED_METADATA_TERNARY)) {
        s.prependLeft(match.index, '/* v8 ignore next */ ');
        changed = true;
      }

      return changed
        ? { code: s.toString(), map: s.generateMap({ hires: true }) }
        : null;
    },
  };
}

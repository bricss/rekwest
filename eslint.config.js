import markdown from '@eslint/markdown';
import ultraRefined from 'eslint-config-ultra-refined';
import {
  defineConfig,
  globalIgnores,
} from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  ...markdown.configs.processor,
  {
    extends: [ultraRefined],
  },
]);

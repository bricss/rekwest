import ultraRefined from 'eslint-config-ultra-refined';
import {
  defineConfig,
  globalIgnores,
} from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist']),
  {
    extends: [ultraRefined],
  },
]);

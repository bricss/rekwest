const { engines: { node } } = require('./package');
const loose = true;
const version = Number.parseInt(node.replace(/\p{Symbol}/gu, ''));

module.exports = function (api) {
  api?.cache(false);
  const useESModules = process.env.NODE_ENV === 'test';

  return {
    plugins: [],
    presets: [
      [
        '@babel/preset-env',
        {
          bugfixes: true,
          loose,
          ...{ modules: useESModules ? false : 'cjs' },
          shippedProposals: true,
          targets: { node: version },
        },
      ],
    ],
  };
};

const { engines: { node } } = require('./package');
const version = Number.parseInt(node.replace(/\p{Symbol}/gu, ''));

module.exports = function (api) {
  api?.cache(false);
  const useESModules = /test/i.test(process.env.NODE_ENV);

  return {
    plugins: [],
    presets: [
      [
        '@babel/preset-env',
        {
          bugfixes: true,
          ...{ modules: useESModules ? false : 'cjs' },
          shippedProposals: true,
          targets: { node: version },
        },
      ],
    ],
  };
};

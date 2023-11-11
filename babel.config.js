const { engines: { node } } = require('./package');
const version = Number.parseInt(node.replace(/\p{Symbol}/gu, ''));

module.exports = function (api) {
  api?.cache(false);

  return {
    plugins: [],
    presets: [
      [
        '@babel/preset-env',
        {
          bugfixes: true,
          shippedProposals: true,
          targets: { node: version },
        },
      ],
    ],
  };
};

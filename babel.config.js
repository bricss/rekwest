import pkg from './package.json' with { type: 'json' };

const { engines: { node } } = pkg;
const version = Number.parseInt(node.replace(/\p{Symbol}/gu, ''), 10);

export default function (api) {
  api?.cache(false);

  return {
    plugins: [],
    presets: [['@babel/preset-env']],
    targets: { node: version },
  };
}

const loose = true;

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
        },
      ],
    ],
  };
};

module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/core/**/*.js',
    'src/ui/**/*.js',
  ],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};

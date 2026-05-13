module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': ['ts-jest', { useESM: false }]
  },
  testEnvironment: 'node',
  testRegex: '/tests/.*\\.(test|spec)?\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: ['node_modules/(?!uuid)'],
  setupFiles: ['./tests/setup.ts']
};
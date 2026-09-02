export const NodeEnvs = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const

export type NodeEnv = (typeof NodeEnvs)[keyof typeof NodeEnvs]

export const NODE_ENV_VALUES = Object.values(NodeEnvs) as [NodeEnv, ...NodeEnv[]]

export const categories = [
  'Authentication',
  'Authorization',
  'Communication',
  'Database',
  'DevTools',
  'Extensions',
  'Messaging',
  'Monitoring',
  'Payment',
  'Rendering',
  'Security',
  'Starter kits',
  'Storage',
  'Testing',
] as const

export type Category = (typeof categories)[number]

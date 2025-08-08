
// Deployment-specific Prisma configuration
module.exports = {
  prisma: {
    binaryTargets: ['native', 'rhel-openssl-3.0.x'],
    engineType: 'binary',
  },
};

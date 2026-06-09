module.exports = {
  apps: [
    {
      name: 'aisa',
      cwd: 'E:/素材库/上班/智能体课题/AISA-master',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

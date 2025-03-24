# zoom-middleware
zoom-clickup-integration/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   └── logger.ts
│   ├── controllers/
│   │   ├── webhookController.ts
│   │   └── testController.ts
│   ├── services/
│   │   ├── audioService.ts
│   │   ├── transcriptionService.ts
│   │   ├── extractionService.ts
│   │   └── clickupService.ts
│   ├── middleware/
│   │   ├── zoomAuthMiddleware.ts
│   │   └── errorHandler.ts
│   ├── routes/
│   │   ├── webhookRoutes.ts
│   │   └── testRoutes.ts
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── fileUtils.ts
│   │   └── zoomUtils.ts
│   └── app.ts
├── package.json
├── tsconfig.json
├── .env
└── .gitignore
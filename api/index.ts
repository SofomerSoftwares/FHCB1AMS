import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { db } from '../src/server/db/store';
import { apiRouter } from '../src/server/routes';

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  })
);

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Initialize database store on serverless function invocation (cached across warm calls)
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await db.initialize();
    dbInitialized = true;
  }
}

app.use(async (_req, _res, next) => {
  await ensureDb();
  next();
});

app.use('/api', apiRouter);

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

export default app;

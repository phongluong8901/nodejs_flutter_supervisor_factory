import 'dotenv/config';
import dns from 'node:dns';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Server as SocketServer } from 'socket.io';
import { AlertLog, DeviceState, MongoUser, Telemetry } from './models.js';
import { buildInitialMockState, buildMockReading, DEVICE_INVENTORY } from './mock-data.js';
import { findAlerts } from './telemetry.js';

type AuthenticatedUser = {
  id: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      mongoUser?: AuthenticatedUser;
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 3000);
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:7357,http://localhost:3000')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const hostname = new URL(origin).hostname;
    return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
  } catch {
    return false;
  }
}
const uploadDirectory = path.resolve(__dirname, '../uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

function publicApiBase(req: Request): string {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  const host = forwardedHost || req.get('host');
  return `${protocol}://${host}`;
}

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '256kb' }));
app.use('/uploads', express.static(uploadDirectory, { maxAge: '1d', immutable: false }));
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: { origin: (origin, callback) => callback(null, isAllowedOrigin(origin)), methods: ['GET', 'POST'] },
});
io.use((socket, next) => {
  try {
    const token = String(socket.handshake.auth?.token ?? '');
    const payload = jwt.verify(token, jwtSecret()) as JwtPayload;
    if (typeof payload.sub !== 'string') return next(new Error('Invalid session'));
    socket.data.mongoUserId = payload.sub;
    return next();
  } catch {
    return next(new Error('Login required'));
  }
});
io.on('connection', (socket) => {
  socket.join(String(socket.data.mongoUserId));
});

function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ success: false, message });
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters');
  return secret;
}

async function requireMongoUser(req: Request, res: Response, next: NextFunction) {
  const token = req.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token === 'null') return sendError(res, 401, 'Login required');
  try {
    const payload = jwt.verify(token, jwtSecret()) as JwtPayload;
    if (typeof payload.sub !== 'string') return sendError(res, 401, 'Invalid or expired session');
    const user = await MongoUser.findById(payload.sub).select('email').lean();
    if (!user) return sendError(res, 401, 'Account no longer exists');
    req.mongoUser = { id: String(user._id), email: user.email };
    return next();
  } catch {
    return sendError(res, 401, 'Invalid or expired session');
  }
}

function safeUser(user: Record<string, any>) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return { ...safe, id: String(safe._id), _id: String(safe._id) };
}

function serializeLog(log: Record<string, any> & { toObject?: () => Record<string, any> }) {
  const item = typeof log?.toObject === 'function' ? log.toObject() : log;
  return { ...item, id: String(item._id), _id: String(item._id) };
}

function requireMongo(req: Request, res: Response, next: NextFunction) {
  if (mongoose.connection.readyState !== 1) return sendError(res, 503, 'Database is not connected');
  return next();
}

app.get('/health', (_req: Request, res: Response) => res.json({
  ok: true,
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  time: new Date().toISOString(),
}));

const auth = express.Router();
auth.use(requireMongo);
auth.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendError(res, 400, 'Enter a valid email address');
    if (password.length < 8) return sendError(res, 400, 'Password must be at least 8 characters');
    if (await MongoUser.exists({ email })) return sendError(res, 409, 'An account with this email already exists');
    const user = await MongoUser.create({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      name: String(req.body.name ?? email.split('@')[0]).trim(),
    });
    const token = jwt.sign({}, jwtSecret(), { subject: String(user._id), expiresIn: '7d' });
    return res.status(201).json({ token, user: safeUser(user.toObject()) });
  } catch (error) {
    return next(error);
  }
});
auth.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const password = String(req.body.password ?? '');
    const user = await MongoUser.findOne({ email }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return sendError(res, 401, 'Email or password is incorrect');
    }
    const token = jwt.sign({}, jwtSecret(), { subject: String(user._id), expiresIn: '7d' });
    return res.json({ token, user: safeUser(user.toObject()) });
  } catch (error) {
    return next(error);
  }
});
auth.use(requireMongoUser);
auth.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await MongoUser.findById(req.mongoUser?.id).lean();
    if (!user) return sendError(res, 404, 'Account not found');
    return res.json(safeUser(user));
  } catch (error) {
    return next(error);
  }
});
auth.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'age', 'phone', 'address'];
    const updates = Object.fromEntries(Object.entries(req.body as Record<string, unknown>).filter(([key]) => allowed.includes(key)));
    if (updates.age !== undefined && (!Number.isInteger(Number(updates.age)) || Number(updates.age) < 0 || Number(updates.age) > 130)) {
      return sendError(res, 400, 'Age must be an integer between 0 and 130');
    }
    if (updates.age !== undefined) updates.age = Number(updates.age);
    const user = await MongoUser.findByIdAndUpdate(req.mongoUser?.id, { $set: updates }, { new: true, runValidators: true }).lean();
    if (!user) return sendError(res, 404, 'Account not found');
    return res.json(safeUser(user));
  } catch (error) {
    return next(error);
  }
});
const upload = multer({
  dest: uploadDirectory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req: Request, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(new Error('Only JPEG, PNG or WebP images are allowed'));
    return callback(null, true);
  },
});
auth.post('/upload-avatar', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return sendError(res, 400, 'Avatar file is required');
    const ext = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[req.file.mimetype];
    const filename = `${req.mongoUser?.id ?? 'unknown'}-${crypto.randomUUID()}${ext}`;
    const finalPath = path.join(uploadDirectory, filename);
    await fs.promises.rename(req.file.path, finalPath);
    const avatarUrl = `${publicApiBase(req)}/uploads/${filename}`;
    await MongoUser.findByIdAndUpdate(req.mongoUser?.id, { $set: { avatarUrl } });
    return res.status(201).json({ success: true, avatarUrl });
  } catch (error) {
    return next(error);
  }
});
app.use('/auth', auth);

const iot = express.Router();
iot.use(requireMongoUser, requireMongo);
iot.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id }).lean();
    if (!state) return res.json({ iot_sensors: {}, devices_control: {}, rgb_status: {}, led_595_status: {} });
    const online = state.last_seen && Date.now() - new Date(state.last_seen).getTime() < 30_000;
    const sensors = Object.fromEntries((Object.entries(state.iot_sensors ?? {}) as [string, Record<string, any>][]) .map(([key, value]) => [
      key, { ...value, is_online: Boolean(online) },
    ]));
    return res.json({ ...state, iot_sensors: sensors });
  } catch (error) {
    return next(error);
  }
});
iot.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await AlertLog.find({ ownerId: req.mongoUser?.id }).sort({ createdAt: -1 }).limit(200).lean();
    return res.json(logs.map(serializeLog));
  } catch (error) {
    return next(error);
  }
});
iot.get('/telemetry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestedLimit = Number(req.query.limit ?? 120);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 500) : 120;
    const rows = await Telemetry.find({ ownerId: req.mongoUser?.id })
      .sort({ receivedAt: -1 })
      .limit(limit)
      .select('receivedAt sensors devicesControl')
      .lean();
    return res.json(rows.reverse().map((row) => ({
      timestamp: row.receivedAt,
      sensors: row.sensors,
      devices_control: row.devicesControl ?? {},
    })));
  } catch (error) {
    return next(error);
  }
});
iot.delete('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await AlertLog.deleteMany({ ownerId: req.mongoUser?.id });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
iot.patch('/logs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const log = await AlertLog.findOneAndUpdate({ _id: req.params.id, ownerId: req.mongoUser?.id }, { $set: { is_read: Boolean(req.body.is_read) } }, { new: true });
    if (!log) return sendError(res, 404, 'Log not found');
    return res.json(serializeLog(log));
  } catch (error) {
    return next(error);
  }
});
iot.delete('/logs/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AlertLog.findOneAndDelete({ _id: req.params.id, ownerId: req.mongoUser?.id });
    if (!result) return sendError(res, 404, 'Log not found');
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
iot.post('/control', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, is_on: isOn } = req.body as Record<string, unknown>;
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id });
    if (!state) return sendError(res, 404, 'No factory mock data is assigned to this account');

    const devicesControl = (state.devices_control ?? {}) as Record<string, any>;
    if (typeof name !== 'string' || typeof isOn !== 'boolean') return sendError(res, 400, 'Device name and boolean is_on are required');
    if (!Object.hasOwn(devicesControl, name)) return sendError(res, 404, 'Unknown device');
    const device = devicesControl[name];
    await DeviceState.updateOne({ ownerId: req.mongoUser?.id }, { $set: {
      [`devices_control.${name}.is_on`]: isOn,
      [`devices_control.${name}.status`]: isOn ? 'Running' : 'Off',
      [`devices_control.${name}.power`]: isOn ? Number(device.rated_power ?? DEVICE_INVENTORY[name]?.power ?? device.power ?? 0) : 0,
      [`devices_control.${name}.updated_at`]: new Date(),
    } });
    io.to(String(req.mongoUser?.id)).emit('device-state-changed', { name, is_on: isOn });
    return res.json({ success: true, name, is_on: isOn });
  } catch (error) {
    return next(error);
  }
});
iot.patch('/devices/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allowed = ['name', 'power', 'runtime'];
    const deviceId = String(req.params.deviceId);
    const updates = Object.fromEntries(Object.entries(req.body as Record<string, unknown>).filter(([key]) => allowed.includes(key)));
    if (!Object.keys(updates).length) return sendError(res, 400, 'No editable device fields provided');
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id });
    const devicesControl = (state?.devices_control ?? {}) as Record<string, any>;
    if (!devicesControl[deviceId]) return sendError(res, 404, 'Device not found');
    if (updates.power !== undefined) {
      const ratedPower = Number(updates.power);
      if (!Number.isFinite(ratedPower) || ratedPower < 0) return sendError(res, 400, 'Device power must be a non-negative number');
      updates.power = ratedPower;
      updates.rated_power = ratedPower;
      if (!devicesControl[deviceId].is_on) updates.power = 0;
    }
    const set = Object.fromEntries(Object.entries(updates).map(([key, value]) => [`devices_control.${deviceId}.${key}`, value]));
    await DeviceState.updateOne({ ownerId: req.mongoUser?.id }, { $set: set });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
iot.post('/devices/:deviceId/reset-health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceId = String(req.params.deviceId);
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id });
    const devicesControl = (state?.devices_control ?? {}) as Record<string, any>;
    if (!devicesControl[deviceId]) return sendError(res, 404, 'Device not found');
    await DeviceState.updateOne({ ownerId: req.mongoUser?.id }, { $set: { [`devices_control.${deviceId}.runtime`]: 0 } });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
app.use('/iot', iot);

const errorHandler: ErrorRequestHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof multer.MulterError) return sendError(res, 400, error.message);
  if (error instanceof Error && error.message === 'Origin is not allowed by CORS') {
    console.warn(`Blocked CORS origin: ${_req.get('origin') ?? '(missing)'}`);
    return sendError(res, 403, error.message);
  }
  console.error(error);
  if (error && typeof error === 'object' && 'name' in error && error.name === 'CastError') return sendError(res, 400, 'Invalid identifier');
  if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError') return sendError(res, 400, error instanceof Error ? error.message : 'Validation failed');
  return sendError(res, 500, 'Internal server error');
};
app.use(errorHandler);

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  jwtSecret();
  dns.setServers(['1.1.1.1', '1.0.0.1']);
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);
  let simulator: NodeJS.Timeout | undefined;
  const demoEmail = String(process.env.DEMO_USER_EMAIL ?? '').trim().toLowerCase();
  const demoUser = demoEmail ? await MongoUser.findOne({ email: demoEmail }) : null;

  if (demoUser) {
    const ownerId = demoUser._id;
    if (!(await DeviceState.exists({ ownerId }))) {
      await DeviceState.create({ ...buildInitialMockState(), ownerId });
    }
    let tick = 0;
    const writeMockReading = async () => {
      try {
        const previous = await DeviceState.findOne({ ownerId }).lean();
        if (!previous) return;
        const next = buildMockReading(tick++, previous as Record<string, any>);
        const alerts = findAlerts(next, previous as Record<string, any>);
        await DeviceState.updateOne({ ownerId }, { $set: next });
        await Telemetry.create({
          ownerId,
          sensors: next.iot_sensors,
          devicesControl: next.devices_control,
          receivedAt: next.last_seen,
        });
        if (alerts.length) {
          const created = await AlertLog.insertMany(alerts.map((alert) => ({ ...alert, ownerId })));
          for (const alert of created) {
            io.to(String(ownerId)).emit('sensor-alert', { title: alert.title, message: alert.message, id: String(alert._id), sensor: alert.sensor });
          }
        }
      } catch (error) {
        console.error('Mongo mock telemetry update failed:', error);
      }
    };
    await writeMockReading();
    simulator = setInterval(writeMockReading, 5_000);
    console.log(`Mongo mock simulator assigned to ${demoUser.email}`);
  } else {
    console.warn('Mongo mock simulator is idle: run npm run seed to create the configured demo account.');
  }

  httpServer.listen(port, () => {
    console.log(`Smart Factory API listening on http://0.0.0.0:${port}`);
  });
  httpServer.once('close', () => { if (simulator) clearInterval(simulator); });
}

start().catch((error: unknown) => {
  console.error('Startup failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await mongoose.disconnect();
    io.close();
    httpServer.close(() => process.exit(0));
  });
}

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
import { AlertLog, ChatMessage, DeviceState, MongoUser, Telemetry } from './models.js';
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
    await DeviceState.create({ ...buildInitialMockState(), ownerId: user._id });
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
    const allowed = ['name', 'age', 'phone', 'address', 'avatarUrl'];
    const updates = Object.fromEntries(Object.entries(req.body as Record<string, unknown>).filter(([key]) => allowed.includes(key)));
    if (updates.age !== undefined && (!Number.isInteger(Number(updates.age)) || Number(updates.age) < 0 || Number(updates.age) > 130)) {
      return sendError(res, 400, 'Age must be an integer between 0 and 130');
    }
    if (updates.age !== undefined) updates.age = Number(updates.age);
    if (updates.avatarUrl !== undefined && typeof updates.avatarUrl !== 'string') {
      return sendError(res, 400, 'Avatar URL must be a string');
    }
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
    let state = await DeviceState.findOne({ ownerId: req.mongoUser?.id }).lean();
    if (!state) {
      const created = await DeviceState.create({ ...buildInitialMockState(), ownerId: req.mongoUser?.id });
      state = created.toObject();
    }
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
    const allowed = ['name', 'power', 'runtime', 'manual_control'];
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
    io.to(String(req.mongoUser?.id)).emit('device-settings-updated', { deviceId, updates });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});
iot.post('/devices/:deviceId/manual-control', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceId = String(req.params.deviceId);
    const manualControl = req.body;
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id });
    const devicesControl = (state?.devices_control ?? {}) as Record<string, any>;
    if (!devicesControl[deviceId]) return sendError(res, 404, 'Device not found');
    await DeviceState.updateOne(
      { ownerId: req.mongoUser?.id },
      { $set: { [`devices_control.${deviceId}.manual_control`]: manualControl } }
    );
    io.to(String(req.mongoUser?.id)).emit('manual-control-changed', { deviceId, manual_control: manualControl });
    return res.json({ success: true, deviceId, manual_control: manualControl });
  } catch (error) {
    return next(error);
  }
});
iot.post('/batch-control', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action } = req.body as { action: 'emergency_stop' | 'start_all' | 'maintenance' | 'eco_mode' };
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id });
    if (!state) return sendError(res, 404, 'State not found');
    const devicesControl = (state.devices_control ?? {}) as Record<string, any>;
    const updates: Record<string, any> = {};
    for (const [id, dev] of Object.entries(devicesControl)) {
      if (action === 'emergency_stop') {
        updates[`devices_control.${id}.is_on`] = false;
        updates[`devices_control.${id}.status`] = 'Stopped (Emergency)';
        updates[`devices_control.${id}.power`] = 0;
      } else if (action === 'start_all') {
        updates[`devices_control.${id}.is_on`] = true;
        updates[`devices_control.${id}.status`] = 'Running';
        updates[`devices_control.${id}.power`] = dev.rated_power ?? dev.power ?? 100;
      } else if (action === 'maintenance') {
        updates[`devices_control.${id}.is_on`] = false;
        updates[`devices_control.${id}.status`] = 'Maintenance';
        updates[`devices_control.${id}.power`] = 0;
        updates[`devices_control.${id}.runtime`] = 0;
      } else if (action === 'eco_mode') {
        const isCore = id.includes('robot') || id.includes('conveyor');
        updates[`devices_control.${id}.is_on`] = isCore;
        updates[`devices_control.${id}.status`] = isCore ? 'Running (Eco)' : 'Off';
        updates[`devices_control.${id}.power`] = isCore ? Math.round((dev.rated_power ?? dev.power ?? 100) * 0.7) : 0;
      }
    }
    await DeviceState.updateOne({ ownerId: req.mongoUser?.id }, { $set: updates });
    io.to(String(req.mongoUser?.id)).emit('batch-control-executed', { action });
    return res.json({ success: true, action });
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

// Device CRUD: Add custom device
iot.post('/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, name, category, icon, power, position, scale, color } = req.body;
    if (!id || !name || !category) return sendError(res, 400, 'id, name, and category are required');
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id });
    if (!state) return sendError(res, 404, 'Device state not found');

    const devicesControl = (state.devices_control ?? {}) as Record<string, any>;
    if (devicesControl[id]) return sendError(res, 409, 'Device with this ID already exists');

    const newDevice = {
      name,
      category,
      icon: icon ?? 'machine',
      power: Number(power ?? 200),
      rated_power: Number(power ?? 200),
      is_on: false,
      status: 'Off',
      runtime: 0,
      health: 100,
      updated_at: new Date(),
    };

    const layout = (state.factory_layout ?? {}) as Record<string, any>;
    const newLayout: Record<string, any> = {
      ...layout,
      [id]: {
        position: position ?? [0, 0.25, 0],
        scale: scale ?? [1, 1, 1],
        color: color ?? '#38bdf8',
      },
    };

    await DeviceState.updateOne(
      { ownerId: req.mongoUser?.id },
      {
        $set: {
          [`devices_control.${id}`]: newDevice,
          factory_layout: newLayout,
        },
      },
    );
    io.to(String(req.mongoUser?.id)).emit('device-added', { id, device: newDevice, layout: newLayout[id] });
    return res.status(201).json({ success: true, id, device: newDevice, layout: newLayout[id] });
  } catch (error) {
    return next(error);
  }
});

// Device CRUD: Delete device
iot.delete('/devices/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deviceId = String(req.params.deviceId);
    const state = await DeviceState.findOne({ ownerId: req.mongoUser?.id });
    if (!state) return sendError(res, 404, 'Device state not found');

    const devicesControl = (state.devices_control ?? {}) as Record<string, any>;
    if (!devicesControl[deviceId]) return sendError(res, 404, 'Device not found');

    await DeviceState.updateOne(
      { ownerId: req.mongoUser?.id },
      {
        $unset: {
          [`devices_control.${deviceId}`]: 1,
          [`factory_layout.${deviceId}`]: 1,
        },
      },
    );
    io.to(String(req.mongoUser?.id)).emit('device-deleted', { deviceId });
    return res.json({ success: true, deviceId });
  } catch (error) {
    return next(error);
  }
});

// Layout: Save custom 2D/3D layout
iot.patch('/layout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const layout = req.body;
    await DeviceState.updateOne(
      { ownerId: req.mongoUser?.id },
      { $set: { factory_layout: layout } },
    );
    io.to(String(req.mongoUser?.id)).emit('layout-updated', { layout });
    return res.json({ success: true, layout });
  } catch (error) {
    return next(error);
  }
});

// Layout: Reset layout to default
iot.post('/layout/reset', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const initial = buildInitialMockState();
    await DeviceState.updateOne(
      { ownerId: req.mongoUser?.id },
      {
        $set: {
          devices_control: initial.devices_control,
          factory_layout: null,
        },
      },
    );
    io.to(String(req.mongoUser?.id)).emit('layout-reset', {});
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

// Chat / M2M Communication Room Endpoints
iot.get('/chat/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const channel = String(req.query.channel ?? 'general');
    let messages = await ChatMessage.find({ ownerId: req.mongoUser?.id, channel })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean();

    // If channel is empty, seed initial starter M2M dialogue
    if (!messages.length) {
      const starters = [
        {
          ownerId: req.mongoUser?.id,
          channel: 'general',
          senderId: 'supervisor_core',
          senderName: 'NEXUS SUPERVISOR AI',
          senderRole: 'supervisor',
          avatar: '🤖',
          content: 'Hệ thống điều phối trung tâm đã kích hoạt. 16 thiết bị IoT đã đồng bộ phiên làm việc.',
          meta: { status: 'ONLINE', clearance: 'LEVEL-4' },
          createdAt: new Date(Date.now() - 60000),
        },
        {
          ownerId: req.mongoUser?.id,
          channel: 'general',
          senderId: 'avg_robot_1',
          senderName: 'AGV-ROBOT-01',
          senderRole: 'device',
          avatar: '🚗',
          content: 'AGV 1 báo cáo: Pin 96%, radar LiDAR sẵn sàng. Đang chờ phân bổ hành trình từ Supervisor.',
          meta: { battery: 96, x: 0, z: 0 },
          createdAt: new Date(Date.now() - 45000),
        },
        {
          ownerId: req.mongoUser?.id,
          channel: 'general',
          senderId: 'arm_robot_1',
          senderName: 'ARM-ROBOT-01',
          senderRole: 'device',
          avatar: '🦾',
          content: 'Robot Arm 1: Đã hiệu chuẩn 4 khớp trục. Kẹp phôi sẵn sàng tiếp nhận pallet từ Băng tải 1.',
          meta: { status: 'STANDBY', joints: 4 },
          createdAt: new Date(Date.now() - 30000),
        },
        {
          ownerId: req.mongoUser?.id,
          channel: 'general',
          senderId: 'security_camera_1',
          senderName: 'CAM-NORTH-01',
          senderRole: 'device',
          avatar: '📹',
          content: 'Camera Góc 1: Tầm nhìn thông thoáng. Không phát hiện vật cản trên luồng di chuyển AGV.',
          meta: { fov: '140°', fps: 60 },
          createdAt: new Date(Date.now() - 15000),
        },
      ];
      await ChatMessage.insertMany(starters);
      messages = await ChatMessage.find({ ownerId: req.mongoUser?.id, channel })
        .sort({ createdAt: -1 })
        .limit(60)
        .lean();
    }

    return res.json(messages.reverse().map((m) => ({
      ...m,
      id: String(m._id),
      _id: String(m._id),
    })));
  } catch (error) {
    return next(error);
  }
});

iot.post('/chat/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, channel = 'general', senderName = 'Operator' } = req.body;
    if (!content || !String(content).trim()) return sendError(res, 400, 'Content is required');

    const userMsg = await ChatMessage.create({
      ownerId: req.mongoUser?.id,
      channel,
      senderId: req.mongoUser?.id,
      senderName,
      senderRole: 'user',
      avatar: '👨‍✈️',
      content: String(content).trim(),
      meta: { timestamp: new Date().toISOString() },
    });

    const userObj = { ...userMsg.toObject(), id: String(userMsg._id), _id: String(userMsg._id) };
    io.to(String(req.mongoUser?.id)).emit('device-chat-message', userObj);

    // AI Virtual Supervisor response simulation
    setTimeout(async () => {
      try {
        const text = String(content).toLowerCase();
        let replyName = 'NEXUS SUPERVISOR AI';
        let replyRole = 'supervisor';
        let replyAvatar = '🤖';
        let replyContent = `Đã ghi nhận chỉ thị: "${content}". Hệ thống giám sát đang duy trì vận hành ổn định.`;

        if (text.includes('agv') || text.includes('xe') || text.includes('chạy') || text.includes('di chuyển')) {
          replyName = 'AGV-ROBOT-01';
          replyRole = 'device';
          replyAvatar = '🚗';
          replyContent = 'AGV-01 nhận lệnh! Đang kích hoạt lộ trình tuần tra, cảm biến LiDAR quét 360° an toàn.';
        } else if (text.includes('robot') || text.includes('arm') || text.includes('gắp') || text.includes('lắp')) {
          replyName = 'ARM-ROBOT-01';
          replyRole = 'device';
          replyAvatar = '🦾';
          replyContent = 'Arm-01 xác nhận! Góc xoay đế đã căn chỉnh, bắt đầu chu kỳ kiểm tra phôi sản xuất.';
        } else if (text.includes('camera') || text.includes('nhìn') || text.includes('an ninh')) {
          replyName = 'CAM-NORTH-01';
          replyRole = 'device';
          replyAvatar = '📹';
          replyContent = 'CCTV Góc 1 xác nhận: Luồng video trực tiếp 1080p ổn định, không có cảnh báo nhiệt độ cao.';
        } else if (text.includes('dừng') || text.includes('stop') || text.includes('khẩn cấp')) {
          replyName = 'NEXUS SUPERVISOR AI';
          replyRole = 'supervisor';
          replyAvatar = '🚨';
          replyContent = 'CẢNH BÁO: Supervisor đã nhận yêu cầu kiểm soát an toàn! Đang thông báo đến tất cả các node.';
        } else if (text.includes('báo cáo') || text.includes('tình trạng') || text.includes('status')) {
          replyName = 'NEXUS SUPERVISOR AI';
          replyRole = 'supervisor';
          replyAvatar = '🤖';
          replyContent = 'BÁO CÁO NHANH: Toàn bộ dây chuyền hoạt động bình thường. 16/16 thiết bị phản hồi tín hiệu.';
        }

        const botMsg = await ChatMessage.create({
          ownerId: req.mongoUser?.id,
          channel,
          senderId: 'supervisor_ai_agent',
          senderName: replyName,
          senderRole: replyRole,
          avatar: replyAvatar,
          content: replyContent,
          meta: { aiGenerated: true },
        });

        const botObj = { ...botMsg.toObject(), id: String(botMsg._id), _id: String(botMsg._id) };
        io.to(String(req.mongoUser?.id)).emit('device-chat-message', botObj);
      } catch (err) {
        console.error('Failed to generate supervisor reply:', err);
      }
    }, 900);

    return res.status(201).json(userObj);
  } catch (error) {
    return next(error);
  }
});

iot.delete('/chat/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const channel = String(req.query.channel ?? 'general');
    await ChatMessage.deleteMany({ ownerId: req.mongoUser?.id, channel });
    io.to(String(req.mongoUser?.id)).emit('chat-cleared', { channel });
    return res.json({ success: true, channel });
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

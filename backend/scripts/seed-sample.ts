import 'dotenv/config';
import bcrypt from 'bcryptjs';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { AlertLog, DeviceState, MongoUser, Telemetry } from '../src/models.js';
import { buildInitialMockState } from '../src/mock-data.js';

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  const email = String(process.env.DEMO_USER_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD ?? '';
  if (!email) throw new Error('DEMO_USER_EMAIL is required');
  if (password.length < 12) throw new Error('DEMO_USER_PASSWORD must be at least 12 characters');
  dns.setServers(['1.1.1.1', '1.0.0.1']);
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await MongoUser.findOneAndUpdate(
    { email },
    { $setOnInsert: { email, passwordHash: await bcrypt.hash(password, 12), name: 'Factory Demo Operator' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  const sampleState = buildInitialMockState();
  await DeviceState.deleteMany({ ownerId: { $exists: false } });
  await Telemetry.deleteMany({ ownerId: { $exists: false } });
  await AlertLog.deleteMany({ ownerId: { $exists: false } });
  await DeviceState.findOneAndUpdate(
    { ownerId: user._id },
    { $set: { ...sampleState, ownerId: user._id } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await Telemetry.create({
    ownerId: user._id,
    sensors: sampleState.iot_sensors,
    devicesControl: sampleState.devices_control,
    receivedAt: sampleState.last_seen,
  });

  await AlertLog.deleteMany({ ownerId: user._id });
  await AlertLog.create({
    ownerId: user._id,
    title: 'Dữ liệu mô phỏng đã sẵn sàng',
    message: '4 cảm biến và 16 thiết bị đã được khởi tạo trong MongoDB.',
    type: 'info',
    is_read: false,
    sensor: null,
  });

  console.log(`Sample data assigned to ${email}: ${Object.keys(sampleState.iot_sensors).length} sensors, ${Object.keys(sampleState.devices_control).length} devices.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
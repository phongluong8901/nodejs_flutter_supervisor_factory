import mongoose from 'mongoose';

const { Schema } = mongoose;

const telemetrySchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'MongoUser', required: true, index: true },
    receivedAt: { type: Date, default: Date.now, index: true },
    sensors: { type: Schema.Types.Mixed, required: true },
    devicesControl: { type: Schema.Types.Mixed, default: {} },
    rgbStatus: { type: Schema.Types.Mixed, default: {} },
    led595Status: { type: Schema.Types.Mixed, default: {} },
    maxLevel: { type: String, default: 'GREEN' },
  },
  { minimize: false },
);

const deviceStateSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'MongoUser', required: true, unique: true, index: true },
    iot_sensors: { type: Schema.Types.Mixed, default: {} },
    devices_control: { type: Schema.Types.Mixed, default: {} },
    rgb_status: { type: Schema.Types.Mixed, default: {} },
    led_595_status: { type: Schema.Types.Mixed, default: {} },
    last_seen: { type: Date, default: null },
  },
  { minimize: false, timestamps: true },
);

const logSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'MongoUser', required: true, index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['warning', 'info'], default: 'info' },
    is_read: { type: Boolean, default: false },
    sensor: { type: String, default: null },
  },
  { timestamps: true },
);

const mongoUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, default: '' },
    age: { type: Number, default: null },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
  },
  { timestamps: true, strict: true },
);

export const Telemetry = mongoose.model('Telemetry', telemetrySchema);
export const DeviceState = mongoose.model('DeviceState', deviceStateSchema);
export const AlertLog = mongoose.model('AlertLog', logSchema);
export const MongoUser = mongoose.model('MongoUser', mongoUserSchema);

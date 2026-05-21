import { z } from 'zod';
import { PaginationSchema, TenantFilterSchema } from './common.js';

export const DevicesListSchema = z.object({
  ...PaginationSchema.shape,
  ...TenantFilterSchema.shape,
  filter_deviceType: z.string().optional(),
  filter_modifiedAfter: z.string().optional(),
  filter_vendorName: z.string().optional(),
  filter_onlineStatus: z.enum(['online', 'offline', 'unreachable', 'testing', 'unknown', 'dormant', 'notPresent', 'lowerLayerDown']).optional(),
}).optional();

export const DeviceGetSchema = z.object({
  deviceId: z.string(),
  ...TenantFilterSchema.shape,
});

export const DeviceDetailsSchema = z.object({
  deviceId: z.string(),
  ...TenantFilterSchema.shape,
});

export const DeviceWarrantySchema = z.object({
  deviceId: z.string(),
  ...TenantFilterSchema.shape,
});

export const DeviceLifecycleSchema = z.object({
  deviceId: z.string(),
  ...TenantFilterSchema.shape,
});
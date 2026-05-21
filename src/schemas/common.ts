import { z } from 'zod';

export const PaginationSchema = z.object({
  page: z.number().optional(),
  pageSize: z.number().min(1).max(1000).optional(),
});

export const DateRangeSchema = z.object({
  fromTime: z.string().optional(),
  thruTime: z.string().optional(),
});

export const TenantFilterSchema = z.object({
  tenants: z.string().optional(),
});
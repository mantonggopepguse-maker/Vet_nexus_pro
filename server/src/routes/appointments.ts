import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { logAudit } from '../utils/auditLogger.js';
import { Prisma } from '@prisma/client';

const router = Router();

const appointmentSchema = z.object({
  clientId: z.string().optional().nullable(),
  patientId: z.string().optional().nullable(),
  manualClient: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
    phone: z.string().min(1),
    address: z.string().optional().nullable()
  }).optional().nullable(),
  procedureId: z.string().min(1),
  date: z.string().min(1),
  time: z.string().min(1),
  notes: z.string().optional(),
  status: z.enum(['Pending', 'Confirmed', 'Completed', 'Cancelled']).default('Pending'),
  staffId: z.string().optional().nullable(),
  clinicId: z.string().optional() // For SuperAdmin
});

// Get all appointments with filtering
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { date, status, clientId, staffId, page = '1', limit = '50' } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    let where: any = req.user?.isSuperAdmin ? {} : { clinicId: req.user?.clinicId as string };

    if (date) {
      where.date = date as string;
    }
    if (status) {
      where.status = status as string;
    }
    if (clientId) {
      where.clientId = clientId as string;
    }
    if (staffId) {
      where.staffId = staffId as string;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        client: true,
        procedure: true,
        staff: true
      },
      take: limitNum,
      skip: skip,
      orderBy: { date: 'desc' }
    });

    res.json(appointments);
  } catch (error) {
    console.error('Get appointments error:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Get single appointment
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.id as string },
      include: {
        client: true,
        procedure: true,
        staff: true
      }
    });

    if (appointment && !req.user?.isSuperAdmin && appointment.clinicId !== req.user?.clinicId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    console.error('Get appointment error:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
});

// Create appointment
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { clinicId: requestedClinicId, ...data } = appointmentSchema.parse(req.body);

    let clinicId = req.user?.clinicId;

    // If user is superadmin, use clinicId from request body
    if (req.user?.isSuperAdmin) {
      if (!requestedClinicId) {
        return res.status(400).json({ error: 'Clinic ID is required for SuperAdmin' });
      }
      clinicId = requestedClinicId;
    }
    // For regular users, use their clinicId
    else if (!clinicId) {
      return res.status(400).json({ error: 'User is not associated with a clinic' });
    }

    // Check for conflicts: Same staff, same time
    if (data.staffId) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          clinicId,
          staffId: data.staffId,
          date: data.date,
          time: data.time,
          status: { notIn: ['Cancelled', 'Completed'] } // Ignore cancelled/completed
        }
      });

      if (conflict) {
        return res.status(409).json({ error: 'This time slot is already booked for the selected staff member.' });
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        clinicId: clinicId,
        clientId: data.clientId || null,
        patientId: data.patientId || null,
        manualClient: data.manualClient ? (data.manualClient as any) : undefined,
        procedureId: data.procedureId,
        date: data.date,
        time: data.time,
        notes: data.notes,
        status: data.status,
        staffId: data.staffId || null
      },
      include: {
        client: true,
        procedure: true,
        staff: true
      }
    });

    // Log Audit
    if (req.user?.id) {
        await logAudit(req.user.id, 'APPOINTMENTS', 'CREATE', `Booked appointment for ${data.date} at ${data.time}`, clinicId as string, req.user.name);
    }

    res.status(201).json(appointment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('Appointment validation error:', JSON.stringify(error.errors, null, 2));
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create appointment error:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// Update appointment
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = appointmentSchema.parse(req.body);

    // Verify existence and permission
    const existingAppointment = await prisma.appointment.findFirst({
      where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
    });

    if (!existingAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check for conflicts on update (if time/date/staff changed)
    if (data.staffId && (data.date !== existingAppointment.date || data.time !== existingAppointment.time || data.staffId !== existingAppointment.staffId)) {
      const conflict = await prisma.appointment.findFirst({
        where: {
          clinicId: req.user?.clinicId,
          staffId: data.staffId,
          date: data.date,
          time: data.time,
          status: { notIn: ['Cancelled', 'Completed'] },
          id: { not: req.params.id as string } // Exclude self
        }
      });

      if (conflict) {
        return res.status(409).json({ error: 'This time slot is already booked for the selected staff member.' });
      }
    }

    const appointment = await prisma.appointment.update({
      where: { id: req.params.id as string },
      data: {
        clientId: data.clientId || null,
        patientId: data.patientId || null,
        manualClient: data.manualClient ? (data.manualClient as any) : Prisma.JsonNull,
        procedureId: data.procedureId,
        date: data.date,
        time: data.time,
        notes: data.notes,
        status: data.status,
        staffId: data.staffId || null,
        clinicId: data.clinicId,
        updatedAt: new Date()
      },
      include: {
        client: true,
        procedure: true,
        staff: true
      }
    });

    if (req.user?.id) {
        await logAudit(req.user.id, 'APPOINTMENTS', 'UPDATE', `Updated appointment ${req.params.id}`, req.user.clinicId as string, req.user.name);
    }

    res.json(appointment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update appointment error:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

// Delete appointment - Admin Only
router.delete('/:id', authenticate, authorize('Admin'), async (req: AuthRequest, res) => {
  try {
    // Verify existence and permission
    const existingAppointment = await prisma.appointment.findFirst({
      where: req.user?.isSuperAdmin ? { id: req.params.id as string } : { id: req.params.id as string, clinicId: req.user?.clinicId as string }
    });

    if (!existingAppointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    await prisma.appointment.delete({
      where: { id: req.params.id as string }
    });

    if (req.user?.id) {
        await logAudit(req.user.id, 'APPOINTMENTS', 'DELETE', `Deleted appointment ${req.params.id}`, req.user.clinicId as string, req.user.name);
    }

    res.status(204).send();
  } catch (error) {
    console.error('Delete appointment error:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

export default router;

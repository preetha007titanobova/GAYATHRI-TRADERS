import { Request, Response } from 'express';
import * as staffService from '../services/staff.service';

export const getNextStaffCode = async (req: Request, res: Response) => {
  try {
    const staffCode = await staffService.getNextStaffCode();
    res.json({ staffCode });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate staff code', details: error.message });
  }
};

export const searchStaff = async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const status = req.query.status as string || '';
    const staffList = await staffService.searchStaff(q, status);
    res.json(staffList);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch staff members', details: error.message });
  }
};

export const createStaff = async (req: Request, res: Response) => {
  try {
    const result = await staffService.createStaff(req.body);
    res.json({ success: true, id: result.insertedId.toString(), message: 'Staff created successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create staff', details: error.message });
  }
};

export const updateStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await staffService.updateStaff(id as string, req.body);
    if (!success) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ success: true, message: 'Staff updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update staff', details: error.message });
  }
};

export const deleteStaff = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await staffService.deleteStaff(id as string);
    if (!success) return res.status(404).json({ error: 'Staff member not found' });
    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete staff', details: error.message });
  }
};

export const getAttendanceByDate = async (req: Request, res: Response) => {
  try {
    const dateStr = req.query.date as string || new Date().toISOString().split('T')[0];
    const data = await staffService.getAttendanceByDate(dateStr);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch attendance', details: error.message });
  }
};

export const saveBulkAttendance = async (req: Request, res: Response) => {
  try {
    const { dateStr, records } = req.body;
    await staffService.saveBulkAttendance(dateStr, records);
    res.json({ success: true, message: 'Attendance saved successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save attendance', details: error.message });
  }
};

export const processBiometricPunch = async (req: Request, res: Response) => {
  try {
    const { identifier, dateStr } = req.body;
    if (!identifier) {
      return res.status(400).json({ error: 'Biometric identifier is required' });
    }
    const todayStr = dateStr || new Date().toISOString().split('T')[0];
    const result = await staffService.processBiometricPunch(identifier, todayStr);
    if (!result.success) {
      return res.status(404).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Biometric punch processing failed', details: error.message });
  }
};


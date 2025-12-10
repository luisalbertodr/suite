
export interface Employee {
  id: string;
  name: string;
  color: string;
}

export interface Appointment {
  id: string;
  employeeId: string;
  clientName: string;
  description: string;
  startTime: string; // formato HH:mm
  endTime: string;   // formato HH:mm
  date: string;      // formato YYYY-MM-DD
  color: string;
  status: 'confirmed' | 'pending' | 'cancelled';
}

export interface TimeSlot {
  time: string;
  hour: number;
  minute: number;
}

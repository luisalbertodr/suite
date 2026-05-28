import * as React from 'react';
import { SelectContent } from '@/components/ui/select';
import { AGENDA_APPOINTMENT_SELECT_Z } from '@/lib/agendaResourceColors';
import { cn } from '@/lib/utils';

/** SelectContent con z-index por encima del modal de cita (z-80). */
export const AppointmentSelectContent = React.forwardRef<
  React.ElementRef<typeof SelectContent>,
  React.ComponentPropsWithoutRef<typeof SelectContent>
>(({ className, ...props }, ref) => (
  <SelectContent ref={ref} className={cn(AGENDA_APPOINTMENT_SELECT_Z, className)} {...props} />
));
AppointmentSelectContent.displayName = 'AppointmentSelectContent';

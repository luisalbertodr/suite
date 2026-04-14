import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  customerId: string;
}

export const ClienteCitasTab: React.FC<Props> = ({ customerId }) => {
  const { data: appointments, isLoading } = useQuery({
    queryKey: ['customer_appointments', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agenda_appointments')
        .select('*, agenda_employees(name)')
        .eq('customer_id', customerId)
        .order('start_time', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Cargando...</div>;

  if (!appointments?.length) {
    return <div className="text-center py-8 text-muted-foreground">No hay citas registradas</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Citas ({appointments.length})</h3>
      {appointments.map((apt) => (
        <Card key={apt.id}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">{apt.title}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {format(new Date(apt.start_time), 'dd/MM/yyyy HH:mm')} - {format(new Date(apt.end_time), 'HH:mm')}
                  </div>
                  {(apt as any).agenda_employees?.name && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <User className="w-3 h-3" />
                      {(apt as any).agenda_employees.name}
                    </div>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(apt.status)}`}>
                {getStatusLabel(apt.status)}
              </span>
            </div>
            {apt.description && <p className="text-sm text-muted-foreground mt-2">{apt.description}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

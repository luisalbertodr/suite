export type DunasoftPlanArtInput = {
  codart: string;
  hora?: string;
  desart?: string;
};

export type DunasoftCreateAppointmentPayload = {
  codemp: string;
  codcli: string;
  nomcli: string;
  tel1cli?: string;
  fecha: string;
  horini: string;
  horfin: string;
  texto?: string;
  codrec?: string;
  customer_id?: string | null;
  planart?: DunasoftPlanArtInput[];
};

export type DunasoftUpdateAppointmentPayload = Partial<DunasoftCreateAppointmentPayload>;

export type DunasoftDualWriteResult = {
  appointment_id?: string;
  legacy_idplan: number;
  bridge_id?: string;
  outbox_id: number;
  dbf_status: 'pending' | 'applied' | 'error' | 'skipped';
};

export type DunasoftCreateAppointmentResult = DunasoftDualWriteResult & {
  appointment_id: string;
  bridge_id: string;
};

export type DunasoftClienteOption = {
  codcli: string;
  nomcli: string;
  tel1cli?: string;
};

export type DunasoftArticuloOption = {
  codart: string;
  desart: string;
  tiempo?: string | null;
};

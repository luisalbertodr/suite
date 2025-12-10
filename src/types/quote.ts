
export interface Quote {
  id: string;
  number: string;
  customer_id: string;
  issue_date: string;
  valid_until: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  notes?: string;
  currency: string;
  customers?: {
    name: string;
    email?: string;
  } | null;
}

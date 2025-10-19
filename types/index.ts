export type CreditCard = {
  id: string;
  card_number: string;
  card_holder_name: string;
  expiry_date: string;
  cvv: string;
  bank_name: string;
  user_id: string;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: string;
  card_id: string;
};
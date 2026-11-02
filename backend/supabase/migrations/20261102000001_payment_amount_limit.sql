alter table public.participant_payments
  add constraint participant_payments_amount_max_10m
  check (amount <= 10000000);

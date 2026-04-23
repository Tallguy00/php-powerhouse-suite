-- Auto mark bill as paid when a payment is inserted
CREATE OR REPLACE FUNCTION public.mark_bill_paid_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric;
  v_amount numeric;
BEGIN
  SELECT amount_etb INTO v_amount FROM public.bills WHERE id = NEW.bill_id;
  SELECT COALESCE(SUM(amount_etb), 0) INTO v_total FROM public.payments WHERE bill_id = NEW.bill_id;
  IF v_amount IS NOT NULL AND v_total >= v_amount THEN
    UPDATE public.bills SET status = 'paid' WHERE id = NEW.bill_id AND status <> 'paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_bill_paid ON public.payments;
CREATE TRIGGER trg_mark_bill_paid
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.mark_bill_paid_on_payment();

-- Enable realtime for bills and payments
ALTER TABLE public.bills REPLICA IDENTITY FULL;
ALTER TABLE public.payments REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bills'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bills';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'payments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.payments';
  END IF;
END $$;
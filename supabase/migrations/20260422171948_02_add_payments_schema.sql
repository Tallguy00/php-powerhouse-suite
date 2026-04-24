

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount_etb numeric NOT NULL,
  method text NOT NULL,
  reference_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  certificate_number text UNIQUE NOT NULL,
  amount_paid numeric NOT NULL,
  payment_method text NOT NULL,
  generated_at timestamptz DEFAULT now(),
  pdf_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view payments"
  ON payments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create payments"
  ON payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update payments"
  ON payments FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can view certificates"
  ON payment_certificates FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create certificates"
  ON payment_certificates FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_payments_customer_id ON payments(customer_id);
CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_payments_reference ON payments(reference_number);
CREATE INDEX idx_certificates_payment_id ON payment_certificates(payment_id);
CREATE INDEX idx_certificates_customer_id ON payment_certificates(customer_id);
CREATE INDEX idx_certificates_certificate_number ON payment_certificates(certificate_number);

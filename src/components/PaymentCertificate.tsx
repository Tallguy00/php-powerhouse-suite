import { useEffect, useRef } from "react";
import { toast } from "sonner";

export interface CertificateData {
  certificateNumber: string;
  customerName: string;
  accountNumber: string;
  amountPaid: number;
  paymentMethod: string;
  billPeriod: string;
  paymentDate: string;
  referenceNumber: string;
}

export const PaymentCertificate = ({ data }: { data: CertificateData }) => {
  const ref = useRef<HTMLDivElement>(null);

  const downloadPDF = async () => {
    try {
      const { default: html2pdf } = await import("html2pdf.js");

      if (!ref.current) return;

      const options = {
        margin: 10,
        filename: `payment-certificate-${data.certificateNumber}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: "portrait" as const, unit: "mm" as const, format: "a4" as const },
      };

      html2pdf().set(options).from(ref.current).save();
      toast.success("Certificate downloaded");
    } catch (e) {
      toast.error("Failed to download certificate");
    }
  };

  return (
    <div className="space-y-4">
      <div
        ref={ref}
        className="w-full max-w-2xl mx-auto bg-white p-12 border-4 border-primary/20 rounded-lg"
        style={{
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Header */}
        <div className="text-center mb-8 border-b-2 border-primary/30 pb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
              E
            </div>
            <h1 className="text-3xl font-bold text-primary">EthioPower</h1>
          </div>
          <p className="text-muted-foreground text-sm">Ethiopia's Modern Electric Management System</p>
          <h2 className="text-2xl font-bold text-primary mt-4">PAYMENT RECEIPT & CERTIFICATE</h2>
        </div>

        {/* Certificate Number */}
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Certificate Number</p>
          <p className="text-lg font-mono font-bold text-primary">{data.certificateNumber}</p>
        </div>

        {/* Main Content */}
        <div className="space-y-6 mb-8">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Customer Name</p>
              <p className="text-lg font-semibold">{data.customerName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Account Number</p>
              <p className="text-lg font-semibold">{data.accountNumber}</p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-primary/5 p-6 rounded-lg border border-primary/20">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Amount Paid</p>
                <p className="text-2xl font-bold text-primary">
                  {new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(data.amountPaid)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground font-semibold">Payment Method</p>
                <p className="text-lg font-semibold">{data.paymentMethod}</p>
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Billing Period</p>
              <p className="text-sm font-medium">{data.billPeriod}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-muted-foreground font-semibold">Payment Date</p>
              <p className="text-sm font-medium">{data.paymentDate}</p>
            </div>
          </div>

          {/* Reference */}
          <div>
            <p className="text-xs uppercase text-muted-foreground font-semibold">Transaction Reference</p>
            <p className="text-sm font-mono bg-muted p-2 rounded">{data.referenceNumber}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-primary/30 pt-6 text-center space-y-4">
          <div className="flex justify-around mb-8">
            <div className="w-32 text-center">
              <div className="h-12 border-t-2 border-foreground mb-1"></div>
              <p className="text-xs font-semibold">Authorized Signature</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <div className="w-32 text-center">
              <div className="h-12 border-t-2 border-foreground mb-1"></div>
              <p className="text-xs font-semibold">Received by</p>
              <p className="text-xs text-muted-foreground">System Date</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            This certificate serves as proof of payment. Please keep this document for your records.
          </p>
          <p className="text-xs text-muted-foreground border-t pt-2">
            © {new Date().getFullYear()} Ethiopian Electric Power - All Rights Reserved
          </p>
        </div>
      </div>

      {/* Download Button (not in PDF) */}
      <div className="no-print flex justify-center gap-2 mt-6">
        <button
          onClick={downloadPDF}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
        >
          Download Certificate
        </button>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

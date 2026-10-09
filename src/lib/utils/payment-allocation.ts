export interface BasicInvoiceItem {
  id?: string;
  amount: number;
  item_type?: "ut_liability" | "service_fee" | "internal_fee" | "discount" | string;
  itemType?: "ut_liability" | "service_fee" | "internal_fee" | "discount" | string;
  approval_status?: string | null;
  approvalStatus?: string | null;
  source_type?: string | null;
  sourceType?: string | null;
  description?: string | null;
}

export interface PaymentAllocationBreakdown {
  serviceFeeTotal: number;
  serviceFeePaid: number;
  serviceFeeRemaining: number;
  serviceFeeStatus: "unpaid" | "partial" | "paid";

  utLiabilityTotal: number;
  utLiabilityPaid: number;
  utLiabilityRemaining: number;
  utLiabilityStatus: "unpaid" | "partial" | "paid";

  internalFeeTotal: number;
  internalFeePaid: number;
  internalFeeRemaining: number;

  discountTotal: number;

  invoiceTotalAmount: number;
  totalVerifiedPaid: number;
  remainingInvoiceBalance: number;
  invoicePaymentStatus: "unpaid" | "partial" | "paid";
}

/**
 * Calculates priority-based payment allocation for an invoice.
 * Rule:
 * 1. Fulfill Jasa Layanan SALUT (`service_fee`) up to Rp 400.000 (or billed service fee amount) FIRST.
 * 2. Fulfill Iuran / Biaya UT (`ut_liability`) with any remaining payment after SALUT fee is fulfilled.
 * 3. Fulfill internal fees or other items with remaining funds.
 */
export function calculateInvoicePaymentAllocation(
  items: BasicInvoiceItem[],
  totalVerifiedPaidAmount: number
): PaymentAllocationBreakdown {
  let serviceFeeTotal = 0;
  let grossUtLiabilityTotal = 0;
  let utReconciliationDiscountTotal = 0;
  let internalFeeTotal = 0;
  let discountTotal = 0;

  (items || []).forEach((item) => {
    const type = item.item_type || item.itemType;
    const amount = Number(item.amount) || 0;
    const status = item.approval_status || item.approvalStatus;
    const sourceType = item.source_type || item.sourceType;

    if (type === "discount") {
      // Diskon hanya diakui jika sudah disetujui (approved)
      if (status === "approved") {
        discountTotal += amount;
        // Hanya diskon yang terbukti berasal dari rekonsiliasi LIP (source_type = 'lip_reconciliation')
        // yang mengurangi kewajiban UT (ut_liability) secara spesifik, mencakup:
        // 1. Reversal penyesuaian shortage lama via correct_reconciled_lip
        // 2. Diskon penurunan tagihan resmi LIP via reconcile_lip_with_invoice
        // Diskon umum non-rekonsiliasi tidak mengurangi kewajiban UT.
        if (sourceType === "lip_reconciliation") {
          utReconciliationDiscountTotal += amount;
        }
      }
    } else if (type === "service_fee") {
      serviceFeeTotal += amount;
    } else if (type === "ut_liability") {
      grossUtLiabilityTotal += amount;
    } else {
      internalFeeTotal += amount;
    }
  });

  // Kewajiban bersih UT setelah memperhitungkan pembalikan/koreksi rekonsiliasi LIP
  const utLiabilityTotal = Math.max(0, grossUtLiabilityTotal - utReconciliationDiscountTotal);

  const invoiceTotalAmount = Math.max(
    0,
    serviceFeeTotal + grossUtLiabilityTotal + internalFeeTotal - discountTotal
  );

  const totalVerifiedPaid = Math.max(0, totalVerifiedPaidAmount || 0);

  // Priority 1: Service Fee (Jasa Layanan SALUT)
  const serviceFeePaid = Math.min(totalVerifiedPaid, serviceFeeTotal);
  const serviceFeeRemaining = Math.max(0, serviceFeeTotal - serviceFeePaid);
  const serviceFeeStatus: "unpaid" | "partial" | "paid" =
    serviceFeeTotal <= 0
      ? "paid"
      : serviceFeePaid >= serviceFeeTotal
      ? "paid"
      : serviceFeePaid > 0
      ? "partial"
      : "unpaid";

  // Remaining paid amount available for UT Liability & subsequent items
  let fundsLeft = Math.max(0, totalVerifiedPaid - serviceFeePaid);

  // Priority 2: UT Liability (Iuran / Biaya UT)
  const utLiabilityPaid = Math.min(fundsLeft, utLiabilityTotal);
  const utLiabilityRemaining = Math.max(0, utLiabilityTotal - utLiabilityPaid);
  const utLiabilityStatus: "unpaid" | "partial" | "paid" =
    utLiabilityTotal <= 0
      ? "paid"
      : utLiabilityPaid >= utLiabilityTotal
      ? "paid"
      : utLiabilityPaid > 0
      ? "partial"
      : "unpaid";

  fundsLeft = Math.max(0, fundsLeft - utLiabilityPaid);

  // Priority 3: Internal Fees / Other
  const internalFeePaid = Math.min(fundsLeft, internalFeeTotal);
  const internalFeeRemaining = Math.max(0, internalFeeTotal - internalFeePaid);

  const remainingInvoiceBalance = Math.max(0, invoiceTotalAmount - totalVerifiedPaid);
  const invoicePaymentStatus: "unpaid" | "partial" | "paid" =
    invoiceTotalAmount <= 0
      ? "paid"
      : totalVerifiedPaid >= invoiceTotalAmount
      ? "paid"
      : totalVerifiedPaid > 0
      ? "partial"
      : "unpaid";

  return {
    serviceFeeTotal,
    serviceFeePaid,
    serviceFeeRemaining,
    serviceFeeStatus,

    utLiabilityTotal,
    utLiabilityPaid,
    utLiabilityRemaining,
    utLiabilityStatus,

    internalFeeTotal,
    internalFeePaid,
    internalFeeRemaining,

    discountTotal,

    invoiceTotalAmount,
    totalVerifiedPaid,
    remainingInvoiceBalance,
    invoicePaymentStatus,
  };
}

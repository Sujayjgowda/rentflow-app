```
┌───────────────────────────────────────────────────────────┐
│                   HOUSE RENT RECEIPT                        │
│                   (bold, centered)                          │
│                                                               │
│  Receipt No: [001]                       Dated: 01 July 2025│
│                                                               │
│  This is to acknowledge the receipt from [Tenant Name]      │
│  the sum of Rupees [Amount]/- (Rupees [Amount in Words]     │
│  only) in lieu of rent payment for the month of             │
│  [Month Year], towards the property bearing the address     │
│  "[Property Address]".                                      │
│                                                               │
│  Rent Period:        [Month Year]                            │
│  Mode of Payment:    [Cash / Cheque / NEFT / UPI]            │
│  Transaction Ref:    [Cheque No. / UTR / Txn ID, if any]    │
│                                                               │
│                                                               │
│  Owner's Name and Address                                    │
│  ─────────────────────────                                   │
│  [Owner Name]                                                │
│  PAN: [Owner PAN — required if annual rent > ₹1,00,000]     │
│                                                               │
│  [Owner Address]                                              │
│                                                               │
│                                                               │
│                              [Revenue Stamp]                 │
│                       (affix if paid by cash and             │
│                          amount exceeds ₹5,000)               │
│                                                               │
│                                          Signature           │
│                                                               │
│                                         ([Owner Name])        │
└───────────────────────────────────────────────────────────┘
```

## Field Reference

| Field | Required? | Notes |
|---|---|---|
| Receipt No. | Recommended | Unique, sequential — useful for RentFlow's record-keeping |
| Dated | Yes | Use unambiguous format: "01 July 2025", not "1/7/2025" |
| Tenant Name | Yes | Full legal name as on lease |
| Amount (figures + words) | Yes | Always include both |
| Rent Period | Yes | Month + Year the payment covers |
| Property Address | Yes | Full address of rented property |
| Mode of Payment | Yes | Cash / Cheque / NEFT / UPI / Bank Transfer |
| Transaction Ref | Conditional | Cheque number, UTR, or UPI transaction ID — skip for cash |
| Owner Name & Address | Yes | Legal owner/landlord details |
| Owner PAN | Conditional | Mandatory if **annual rent > ₹1,00,000** (i.e. ~₹8,333+/month) — needed for tenant's HRA exemption claim |
| Revenue Stamp | Conditional | Required if rent is paid **in cash** and the amount **exceeds ₹5,000**; stamp must be signed across by the owner |
| Signature | Yes | Owner's signature over/near printed name |

### Notes for RentFlow implementation
- Auto-trigger the **PAN field** and a warning banner when monthly rent × 12 > ₹1,00,000.
- Auto-trigger the **revenue stamp placeholder** when payment mode = Cash and amount > ₹5,000.
- Auto-increment **Receipt No.** per landlord/property to keep records clean and exportable.
- Store **Transaction Ref** only when mode ≠ Cash.

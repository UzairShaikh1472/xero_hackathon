export function loadFallbackData() {
  return {
    company: {
      name: "Northstar Services Ltd",
      currency: "GBP"
    },
    invoices: [
      {
        InvoiceID: "inv_demo_001",
        InvoiceNumber: "INV-001",
        Status: "AUTHORISED",
        DateString: "2026-06-10",
        DueDateString: "2026-06-24",
        Total: 8200,
        AmountDue: 8200,
        CurrencyCode: "GBP",
        Contact: {
          ContactID: "contact_demo_001",
          Name: "Acorn Retail"
        }
      },
      {
        InvoiceID: "inv_demo_002",
        InvoiceNumber: "INV-002",
        Status: "AUTHORISED",
        DateString: "2026-06-18",
        DueDateString: "2026-07-08",
        Total: 3150,
        AmountDue: 3150,
        CurrencyCode: "GBP",
        Contact: {
          ContactID: "contact_demo_002",
          Name: "Blue Finch Studio"
        }
      }
    ],
    contacts: [
      {
        ContactID: "contact_demo_001",
        Name: "Acorn Retail",
        EmailAddress: "finance@acornretail.example"
      },
      {
        ContactID: "contact_demo_002",
        Name: "Blue Finch Studio",
        EmailAddress: "ops@bluefinch.example"
      }
    ],
    payments: []
  };
}

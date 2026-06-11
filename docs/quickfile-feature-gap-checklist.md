# QuickFile-Inspired AgencyIQ Gap Checklist

This is a product/workflow reference only. It is not a client-data transfer plan and it should not copy QuickFile code, screens, databases, or licensed assets.

## What AgencyIQ Already Covers

- Client folders for personal and business accounts.
- New client wizard with identity, contact, address, assignment, and billing basics.
- Policy portfolio with carrier, policy type, policy number, premium, dates, status, renewal status, billing type, commission, mortgagee/lienholder, limits, and notes.
- Billing tracker with payment method, payment plan, responsibility, installment details, finance company, mortgagee/escrow, card/ACH references, invoice details, and notes.
- Tasks, reminders, follow-ups, payment reminders, notes, communications, activity, renewals, reports, carrier portals, IVANS-style download flow, document categories, and ACORD drafts/generation.

## High-Value Missing Areas

### Client Folder

- Additional contacts per client: spouse, business owner, bookkeeper, property manager, certificate contact, emergency contact.
- Contact roles and preferences: decision maker, billing contact, claims contact, renewal contact, do-not-call/do-not-email flags, best time to call.
- Client identifiers: account number, legacy file number, source/referral source, client class, language preference.
- Household/business relationships: related clients, parent company, subsidiaries, spouse/household members.
- Important dates: client anniversary, birthday, business started date, renewal review target date, last account review date.

### Commercial Risk Info

- Multiple business locations/premises, not just one physical address.
- Operations description, NAICS/SIC, class codes, sales by location, payroll by class, square footage, construction/occupancy details.
- Named insured variants, additional insureds, certificate holders, loss payees, mortgagees, landlords, and lienholders as reusable related parties.
- Prior carrier history and underwriting notes by line of business.
- Loss history and loss-run tracking by claim/date/status/amount.

### Personal Lines Info

- Household members and drivers separate from the main client.
- Vehicles, VINs, garaging address, lienholder, usage, annual mileage, and driver assignment.
- Homes/properties with year built, roof year/type, protection class, occupancy, mortgagee, prior claims, and inspection notes.
- Personal umbrella underlying-policy checklist.

### Policy Servicing

- Transaction history: new business, renewal, endorsement, cancellation, reinstatement, rewrite, non-renewal, broker of record.
- Policy service actions with dates and status: endorsement requested, sent to carrier, received, invoiced, delivered to client.
- Prior policy/replaced policy relationship.
- Carrier underwriting contacts and submission status.
- Binder details: bound date, binder expiration, bind method, who bound it.

### Billing And Accounting

- Payment ledger, not just billing summary: payment date, amount, method, reference/check number, receipt number, posted by.
- Agency-bill invoices and receivables status.
- Premium finance schedule: finance company, contract number, down payment, installments, cancellation notice dates.
- Commission statement/reconciliation tracking by carrier and producer.
- Returned payment/NSF workflow.

### Documents And Forms

- True uploaded-document records in the app data model, not only generated document previews.
- Document status workflow: needed, requested, received, reviewed, sent, signed, archived.
- Letter/template center for reusable agency letters: missing info, renewal notice, payment reminder, cancellation warning, reinstatement, thank-you, claim instructions.
- Certificate holder management and certificate issuance history.
- Saved form history tied to client, policy, form type, version, printed/generated date, and user.

### Claims

- Claim records tied to client and policy.
- Claim number, carrier claim number, date of loss, reported date, adjuster, status, paid/reserve amount, description, documents, and notes.
- Claim follow-up tasks and loss-run inclusion flag.

### Reports

- Carrier book report.
- Commission/reconciliation report.
- Cross-sell report.
- Missing info report.
- Expired/cancelled/no-replacement report.
- Renewal workload by CSR/producer.
- Claims/loss history report.
- Certificate holder report.

## Best Build Order

1. Add reusable related parties: contacts, certificate holders, mortgagees/lienholders, additional insureds, and loss payees.
2. Add policy transaction history: endorsement, cancellation, reinstatement, rewrite, renewal, non-renewal, and binder events.
3. Add claim/loss history records.
4. Add real document records and letter templates.
5. Add commercial locations and personal vehicles/drivers/properties.
6. Add payment ledger and commission reconciliation.
7. Add reports based on the new structured records.

## Database Tables To Add Later

- `crm_client_contacts`
- `crm_client_relationships`
- `crm_locations`
- `crm_related_parties`
- `crm_policy_transactions`
- `crm_policy_submissions`
- `crm_claims`
- `crm_payment_ledger`
- `crm_commission_statements`
- `crm_letter_templates`
- `crm_form_history`
- `crm_certificate_holders`
- `crm_certificates`

## UX Notes

- Keep the current AgencyIQ design and client-folder workflow.
- Add these as extra tabs, drawers, or modal sections inside the existing client folder.
- Avoid one giant intake form. Use focused tools: Contacts, Locations, Vehicles, Claims, Transactions, Certificates, Letters.
- Make each missing-info item visible as a folder health flag so CSRs know what to clean up.

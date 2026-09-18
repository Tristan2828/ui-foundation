# Invoice — entity plan

Fixture for `scripts/consume-test.sh <ref> Invoice`: the Fresh UI Build agent
gets this plan (as `docs/entities/invoice.md`) instead of inventing an
entity, the same way a real app's developer would provide one.

## Purpose

An invoice sent to a customer, tracked until it's paid.

## Fields

| Field | Label | Type | Required | Options / rules | List | Filter |
|---|---|---|---|---|---|---|
| number | Invoice Number | text | yes | 1–50 chars, e.g. INV-0042 | column, sortable | search |
| customerName | Customer | text | yes | 1–200 chars | column, sortable | |
| amount | Amount | decimal | yes | 2 places, e.g. 1250.00 | column, sortable | |
| status | Status | single choice | yes | draft, sent, paid; default draft | column, sortable | yes |
| issuedAt | Issued | date-time | yes | picked with a calendar; shown as a date | column, sortable | |
| dueDate | Due | date | no | empty means no due date | column, sortable | |
| notes | Notes | long text | no | up to 2000 chars | | |

## List screen

- Default sort: none (server order).
- Page size: 10.
- Row actions: edit, delete (with confirmation).

## Screens and access

- Screens: list, create, edit, delete.
- Ownership: frontend only in this run (no backend); follow the Widget
  reference.

## Open questions

None.

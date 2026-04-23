# Backend Reference (Lovable Cloud)

This project uses Lovable Cloud (managed Supabase) as its backend. Below is a snapshot of every table, column, RLS policy, database function, and trigger powering the app. Use this file as a quick code-side reference instead of opening the backend dashboard.

> Generated on 2026-04-23 from the live schema. Update by re-running the schema query and pasting the result here.

---

## Tables

### `profiles`
Extra customer info linked 1:1 with `auth.users.id`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | references `auth.users.id` |
| full_name | text | |
| phone | text | |
| address | text | |
| region | text | free-form region label |
| customer_number | text | auto-generated `EEU-XXXXXXXX` |
| created_at / updated_at | timestamptz | defaults `now()` |

**RLS**
- Users can view & update their own profile (`auth.uid() = id`)
- Admins can view & update all profiles
- Technicians can view all profiles
- INSERT/DELETE not allowed — handled by `handle_new_user` trigger

### `user_roles`
Role assignments — **never store roles on profiles**.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | references `auth.users.id` |
| role | enum `app_role` | `admin` \| `technician` \| `customer` |
| created_at | timestamptz | |

**RLS**
- Users can view their own roles
- Admins manage all roles

### `regions`
Ethiopian administrative regions (bilingual).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text | e.g. `AA`, `OR`, `TG` |
| name_en / name_am | text | |
| created_at | timestamptz | |

**RLS**
- Any authenticated user can read
- Admins manage

### `meters`
Electric meters tied to a customer.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| meter_number | text | unique business key |
| customer_id | uuid | the meter owner (`auth.users.id`) |
| customer_type | enum `customer_type` | `residential` \| `commercial` \| `industrial` |
| region_id | uuid | FK → `regions.id` |
| status | text | default `active` |
| installed_at | date | |
| created_at | timestamptz | |

**RLS**
- Customers view their own meters
- Technicians can view all meters
- Admins manage / view all

### `tariffs`
Price per kWh per customer type.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| customer_type | enum `customer_type` | |
| price_per_kwh | numeric | |
| active | boolean | default `true` |
| created_at | timestamptz | |

**RLS**
- Authenticated users read active tariffs (admins read all)
- Admins manage

### `bills`
Monthly invoices generated from meter readings × tariff.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| meter_id | uuid | FK → `meters.id` |
| customer_id | uuid | denormalized for RLS speed |
| period_start / period_end | date | billing window |
| kwh_consumed | numeric | |
| amount_etb | numeric | total due in ETB |
| due_date | date | |
| status | enum `bill_status` | `unpaid` \| `paid` \| `overdue` \| `cancelled` |
| created_at | timestamptz | |

**RLS**
- Customers view their own bills
- Admins view & manage all

### `payments`
Payment events recorded against a bill.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| bill_id | uuid | FK → `bills.id` |
| customer_id | uuid | |
| amount_etb | numeric | |
| method | text | `telebirr`, `cbe`, `awash`, `dashen`, `cash` |
| reference | text | external txn reference |
| paid_at | timestamptz | default `now()` |

**RLS**
- Customers view & create their own payments
- Admins view & manage all

> Trigger `mark_bill_paid_on_payment` flips `bills.status` to `paid` once payments cover the bill total.

### `outages`
Power outage reports — created by customers, worked by technicians.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | text | |
| description | text | |
| location | text | free-form location |
| region_id | uuid | FK → `regions.id` |
| severity | enum `outage_severity` | `low` \| `medium` \| `high` \| `critical` |
| status | enum `outage_status` | `reported` \| `investigating` \| `in_progress` \| `resolved` |
| reported_by | uuid | `auth.users.id` |
| created_at / resolved_at | timestamptz | |

**RLS**
- Any authenticated user can read outages
- Customers can insert outages (must set `reported_by = auth.uid()`)
- Technicians can update outages
- Admins manage all

### `technician_tasks`
Work assignments for technicians, one per outage.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| outage_id | uuid | FK → `outages.id` |
| technician_id | uuid | `auth.users.id` |
| status | enum `task_status` | `assigned` \| `in_progress` \| `completed` |
| notes | text | |
| created_at / updated_at | timestamptz | |

**RLS**
- Technicians view & update their own tasks
- Admins manage all

---

## Enums

| Enum | Values |
|---|---|
| `app_role` | `admin`, `technician`, `customer` |
| `bill_status` | `unpaid`, `paid`, `overdue`, `cancelled` |
| `customer_type` | `residential`, `commercial`, `industrial` |
| `outage_severity` | `low`, `medium`, `high`, `critical` |
| `outage_status` | `reported`, `investigating`, `in_progress`, `resolved` |
| `task_status` | `assigned`, `in_progress`, `completed` |

---

## Database Functions

### `has_role(_user_id uuid, _role app_role) → boolean`
SECURITY DEFINER. Used inside RLS policies to check role membership without recursion.

```sql
SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = _role
);
```

### `handle_new_user() → trigger`
Runs after a new row in `auth.users`. Creates the matching `profiles` row (auto-assigning a `customer_number` like `EEU-XXXXXXXX`) and inserts a default `customer` role into `user_roles`.

### `mark_bill_paid_on_payment() → trigger`
Runs after a row is inserted into `payments`. Sums all payments for the bill and sets `bills.status = 'paid'` once the total reaches `amount_etb`. This is what powers the real-time "Paid" badge on both the customer and admin pages.

### `touch_updated_at() → trigger`
Generic helper that sets `NEW.updated_at = now()` — used by tables with an `updated_at` column.

---

## Realtime Channels Used in App

| Page | Table | Events |
|---|---|---|
| `/admin/payments` | `payments` (INSERT), `bills` (UPDATE) | Toast on new payment, sync bill status |
| `/dashboard/bills` | `bills` (UPDATE) | Customer sees "Paid" instantly |
| `/dashboard/outage-map` | `outages` (*) | Re-fetch on any change |

---

## Quick Access from Code

```ts
import { supabase } from "@/integrations/supabase/client";

// Read with RLS automatically applied:
const { data, error } = await supabase.from("bills").select("*");

// Realtime subscription:
supabase.channel("x").on("postgres_changes",
  { event: "*", schema: "public", table: "outages" },
  (payload) => console.log(payload)
).subscribe();
```

For schema changes always create a new migration in `supabase/migrations/` — never edit `src/integrations/supabase/types.ts` (auto-generated).

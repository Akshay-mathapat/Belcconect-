# PostgreSQL Command-Line Query Guide

This guide describes how to connect to and check your `cityconnect` database tables using the command line.

---

## 1. Connecting to PostgreSQL via Command Line

Open your Command Prompt (`cmd`) or PowerShell, and run the following command to connect using the `psql` interactive terminal:

```bash
psql -U postgres -d cityconnect
```

- `-U postgres`: Connects as the default superuser `postgres`.
- `-d cityconnect`: Connects directly to the `cityconnect` database.

*(If prompted, enter the password you set during PostgreSQL installation, e.g. `postgres` or your custom password).*

---

## 2. Useful psql Command Shortcuts

Once you are logged in (you will see a `cityconnect=#` prompt), you can use these psql shortcuts:

- **List all tables**:
  ```sql
  \dt
  ```
- **Inspect table structure (columns and types)**:
  ```sql
  \d customers
  \d service_providers
  \d job_providers
  \d bookings
  \d services
  \d addresses
  ```
- **Exit psql terminal**:
  ```sql
  \q
  ```

---

## 3. Querying Role-Specific Tables

You can run standard SQL queries to inspect the seeded accounts and registered users:

### Check Registered Customers
```sql
SELECT id, email, name, phone FROM customers;
```

### Check Service Providers
```sql
SELECT id, email, name, phone FROM service_providers;
```

### Check Job Providers
```sql
SELECT id, email, name, phone FROM job_providers;
```

---

## 4. Querying Booking & Service Catalog Records

To see bookings and dynamic services added by providers:

### View Active Services
```sql
SELECT id, provider_id, name, category, base_price, is_available FROM services;
```

### View Bookings
```sql
SELECT id, customer_id, provider_id, service_name, price, status FROM bookings;
```

### View Saved Addresses
```sql
SELECT id, user_id, type, text FROM addresses;
```

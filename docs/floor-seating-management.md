# Floor & Seating Management Module

## Module Purpose
This module allows restaurant operators to define and manage their physical dining space, including floor areas, table arrangements, and waiter assignments.

## Features
- **Floor / Area Management**: Define sections like Main Hall, Rooftop, or VIP Lounge.
- **Table Management**: Configure individual tables with seating capacities and status.
- **QR Code Ordering**: Generate unique QR codes for each table to enable customer self-ordering.
- **Visual Table Layout**: A real-time visual monitor of the restaurant floor.
- **Table Assignment**: Assign staff members to specific tables and shifts.

## End-User UI Labels
The module uses simple restaurant-friendly language:
- Use **"Floors / Areas"** instead of "Sections" or "Zones".
- Use **"Table No."** instead of "Table ID".
- Use **"Seating Capacity"** instead of "Maximum Occupants".
- Use **"Current Status"** (Available, Occupied, Reserved, Blocked).
- Avoid technical jargon like "Mapping", "Entity", or "Configuration".

## UI flow
1. **Floors / Areas**: List view with Search and Status filters. Modal form for Add/Edit.
2. **Tables**: Master list with Floor and Status filters. Integrated QR code generator modal.
3. **Table Layout**: Visual grid showing table status with a color-coded legend.
4. **Table Assignment**: Grid for managing Waiter and Shift assignments per table.

## Access Control
- **Client Admin**: Full management access.
- **Manager**: View layout and manage assignments.
- **Waitstaff**: View-only access to assigned tables.

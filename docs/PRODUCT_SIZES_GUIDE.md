# Product Sizes - CRUD Operations Guide

## Overview
The Product Sizes feature allows you to manage size variations for products (e.g., 50ml, 100ml, 250g, 1kg, etc.). This is essential for products that come in different packaging sizes.

## Features Implemented

### ✅ Backend (Already Complete)
1. **Database Table**: `sizes` table with columns:
   - `id` (Primary Key)
   - `name` (Size label like "50ml", "250g")
   - `created_at` (Timestamp)

2. **API Endpoints** (`/api/sizes`):
   - **GET** `/api/sizes` - Retrieve all sizes
   - **POST** `/api/sizes` - Create a new size
   - **PUT** `/api/sizes/:id` - Update an existing size
   - **DELETE** `/api/sizes/:id` - Delete a size

3. **Repository** (`repositories/sizeRepo.js`):
   - `getAll()` - Fetch all sizes ordered by name
   - `create(name)` - Insert new size
   - `update(id, name)` - Update size name
   - `delete(id)` - Remove size

### ✅ Frontend (Already Complete)
1. **Navigation**: "Product Sizes" menu item under Products submenu
2. **Master Data View**: Uses the generic master data table for CRUD operations
3. **Product Integration**: Size dropdown in the product add/edit modal
4. **Product Display**: Size column in the products table

## How to Use

### Access Product Sizes Management
1. Log in to the dashboard
2. Click on **Products** in the sidebar
3. Click on **Product Sizes** in the submenu
4. You'll see a table with all available sizes

### Add a New Size
1. Click the **"+ Add New"** button
2. Enter the size name (e.g., "750ml", "3kg")
3. Optionally add a description
4. Click **Save**

### Edit a Size
1. Click the **Edit** (pencil) icon next to a size
2. Modify the name or description
3. Click **Update**

### Delete a Size
1. Click the **Delete** (trash) icon next to a size
2. Confirm the deletion

### Assign Size to a Product
1. Go to **Products** → **All Products**
2. Click **Add New** or **Edit** an existing product
3. Select the appropriate **Product Size** from the dropdown
4. Save the product

## Sample Sizes Added
The following sizes have been pre-populated:

**Volume (Liquids)**:
- 50ml, 100ml, 200ml, 250ml, 400ml, 500ml, 1L, 2L, 5L

**Weight (Solids)**:
- 50g, 100g, 250g, 500g, 1kg, 5kg, 10kg, 25kg, 50kg

## Technical Details

### Database Schema
```sql
CREATE TABLE sizes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Product-Size Relationship
Products have a `size_id` foreign key that references the `sizes` table:
```sql
ALTER TABLE products ADD COLUMN size_id INTEGER REFERENCES sizes(id);
```

### API Request Examples

**Create a new size**:
```javascript
POST /api/sizes
Content-Type: application/json

{
  "name": "1.5L"
}
```

**Update a size**:
```javascript
PUT /api/sizes/3
Content-Type: application/json

{
  "name": "2.5L"
}
```

**Delete a size**:
```javascript
DELETE /api/sizes/3
```

## Best Practices
1. **Consistent Naming**: Use standard units (ml, L, g, kg)
2. **Avoid Duplicates**: Check if a size already exists before creating
3. **Logical Organization**: Group similar sizes together
4. **Product Association**: Always assign sizes to products for better inventory management

## Troubleshooting

### Size not appearing in dropdown?
- Refresh the page to reload the size list
- Check if the size was successfully created via the API

### Cannot delete a size?
- Ensure no products are currently using this size
- Check for foreign key constraints in the database

### Size column empty in product table?
- Edit the product and assign a size from the dropdown
- Some old products may not have sizes assigned

---

**Status**: ✅ Fully Operational  
**Last Updated**: 2026-01-03

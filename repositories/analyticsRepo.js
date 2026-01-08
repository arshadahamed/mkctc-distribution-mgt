const { allQuery, getQuery } = require('../lib/db');

class AnalyticsRepository {
    async getSalesByDate(dateFrom, dateTo, groupBy = 'daily') {
        let groupSql = "invoice_date";
        if (groupBy === 'weekly') groupSql = "strftime('%Y-%W', invoice_date)";
        else if (groupBy === 'monthly') groupSql = "strftime('%Y-%m', invoice_date)";
        else if (groupBy === 'yearly') groupSql = "strftime('%Y', invoice_date)";

        return allQuery(`
            SELECT 
                ${groupSql} as label,
                COUNT(*) as count,
                SUM(net_total) as total
            FROM invoices
            WHERE status = 'completed'
              AND invoice_date BETWEEN ? AND ?
            GROUP BY ${groupSql}
            ORDER BY label ASC
        `, [dateFrom, dateTo]);
    }

    async getSalesByCustomer(dateFrom, dateTo, limit = 20) {
        return allQuery(`
            SELECT 
                c.name as label,
                COUNT(i.id) as count,
                SUM(i.net_total) as total
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.status = 'completed'
              AND i.invoice_date BETWEEN ? AND ?
            GROUP BY c.id
            ORDER BY total DESC
            LIMIT ?
        `, [dateFrom, dateTo, limit]);
    }

    async getSalesByRoute(dateFrom, dateTo) {
        return allQuery(`
            SELECT 
                r.name as label,
                COUNT(i.id) as count,
                SUM(i.net_total) as total
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            JOIN routes r ON c.route_id = r.id
            WHERE i.status = 'completed'
              AND i.invoice_date BETWEEN ? AND ?
            GROUP BY r.id
            ORDER BY total DESC
        `, [dateFrom, dateTo]);
    }

    async getSalesBySalesRep(dateFrom, dateTo) {
        return allQuery(`
            SELECT 
                u.username as label,
                COUNT(i.id) as count,
                SUM(i.net_total) as total
            FROM invoices i
            JOIN users u ON i.created_by = u.id
            WHERE i.status = 'completed'
              AND i.invoice_date BETWEEN ? AND ?
            GROUP BY u.id
            ORDER BY total DESC
        `, [dateFrom, dateTo]);
    }

    async getSalesByVehicle(dateFrom, dateTo) {
        return allQuery(`
            SELECT 
                t.registration_number as label,
                COUNT(i.id) as count,
                SUM(i.net_total) as total
            FROM invoices i
            JOIN truck_loads l ON i.load_id = l.id
            JOIN trucks t ON l.truck_id = t.id
            WHERE i.status = 'completed'
              AND i.invoice_date BETWEEN ? AND ?
            GROUP BY t.id
            ORDER BY total DESC
        `, [dateFrom, dateTo]);
    }

    async getTopProducts(dateFrom, dateTo, limit = 10) {
        return allQuery(`
            SELECT 
                p.name as label,
                SUM(ii.quantity) as quantity,
                SUM(ii.line_total) as total
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.status = 'completed'
              AND i.invoice_date BETWEEN ? AND ?
            GROUP BY p.id
            ORDER BY total DESC
            LIMIT ?
        `, [dateFrom, dateTo, limit]);
    }

    async getLowSellingProducts(dateFrom, dateTo, limit = 10) {
        return allQuery(`
            SELECT 
                p.name as label,
                SUM(ii.quantity) as quantity,
                SUM(ii.line_total) as total
            FROM products p
            LEFT JOIN invoice_items ii ON p.id = ii.product_id
            LEFT JOIN invoices i ON ii.invoice_id = i.id AND i.status = 'completed' AND i.invoice_date BETWEEN ? AND ?
            GROUP BY p.id
            ORDER BY total ASC
            LIMIT ?
        `, [dateFrom, dateTo, limit]);
    }

    async getAverageOrderValue(dateFrom, dateTo) {
        return getQuery(`
            SELECT 
                AVG(net_total) as avg_value,
                SUM(net_total) as total_revenue,
                COUNT(*) as total_orders
            FROM invoices
            WHERE status = 'completed'
              AND invoice_date BETWEEN ? AND ?
        `, [dateFrom, dateTo]);
    }

    async getRepeatCustomerRate(dateFrom, dateTo) {
        const stats = await getQuery(`
            WITH CustomerSales AS (
                SELECT customer_id, COUNT(*) as purchase_count
                FROM invoices
                WHERE status = 'completed'
                  AND invoice_date BETWEEN ? AND ?
                GROUP BY customer_id
            )
            SELECT 
                COUNT(*) as total_customers,
                SUM(CASE WHEN purchase_count > 1 THEN 1 ELSE 0 END) as repeat_customers
            FROM CustomerSales
        `, [dateFrom, dateTo]);

        const rate = stats.total_customers > 0
            ? (stats.repeat_customers / stats.total_customers) * 100
            : 0;

        return {
            total_customers: stats.total_customers,
            repeat_customers: stats.repeat_customers,
            repeat_rate: rate
        };
    }

    async getDiscountImpactAnalysis(dateFrom, dateTo) {
        return getQuery(`
            SELECT 
                SUM(net_total) as total_net_sales,
                SUM(bill_discount) as total_bill_discounts,
                SUM(CASE 
                    WHEN bill_discount > 0 THEN 1 
                    ELSE 0 
                END) as discounted_invoices_count,
                COUNT(*) as total_invoices,
                (SELECT SUM(discount_amount) FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.status = 'completed' AND i.invoice_date BETWEEN ? AND ?) as total_item_discounts
            FROM invoices
            WHERE status = 'completed'
              AND invoice_date BETWEEN ? AND ?
        `, [dateFrom, dateTo, dateFrom, dateTo]);
    }

    async getCustomerIntelligence(dateFrom, dateTo) {
        // 1. Customer Metrics (LTV, Credit Usage, Activity)
        const metrics = await allQuery(`
            SELECT 
                c.id, c.name, c.balance, c.credit_limit,
                COUNT(i.id) as period_orders,
                SUM(i.net_total) as period_spend,
                (SELECT SUM(net_total) FROM invoices WHERE customer_id = c.id AND status = 'completed') as lifetime_value,
                MAX(i.invoice_date) as last_purchase,
                MIN(i.invoice_date) as first_purchase,
                (c.balance / NULLIF(c.credit_limit, 0)) * 100 as credit_usage_percent
            FROM customers c
            LEFT JOIN invoices i ON c.id = i.customer_id AND i.status = 'completed' AND i.invoice_date BETWEEN ? AND ?
            WHERE c.status != 'deleted'
            GROUP BY c.id
            ORDER BY period_spend DESC
        `, [dateFrom, dateTo]);

        // 2. Cohort Analysis (New vs In-active)
        const cohort = await getQuery(`
            SELECT 
                COUNT(CASE WHEN first_purchase BETWEEN ? AND ? THEN 1 END) as new_customers,
                COUNT(CASE WHEN last_purchase < date('now', '-90 days') OR last_purchase IS NULL THEN 1 END) as inactive_customers,
                COUNT(*) as total_customers
            FROM (
                SELECT 
                    customer_id, 
                    MIN(invoice_date) as first_purchase,
                    MAX(invoice_date) as last_purchase
                FROM invoices 
                WHERE status = 'completed'
                GROUP BY customer_id
            )
        `, [dateFrom, dateTo]);

        // 3. Outstanding Summary
        const outstanding = await getQuery(`
            SELECT 
                SUM(balance) as total_outstanding,
                COUNT(CASE WHEN balance > credit_limit THEN 1 END) as over_limit_count,
                SUM(CASE WHEN balance > credit_limit THEN balance - credit_limit ELSE 0 END) as over_limit_amount
            FROM customers
            WHERE balance > 0 AND status != 'deleted'
        `);

        return {
            metrics,
            cohort,
            outstanding
        };
    }

    async getInventoryIntelligence(dateFrom, dateTo) {
        // 1. Load Performance (Accuracy & Variances)
        const loadMetrics = await allQuery(`
            SELECT 
                t.registration_number as label,
                SUM(li.quantity_loaded) as loaded,
                (SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.load_id = l.id AND i.status = 'completed') as delivered,
                SUM(COALESCE(ui.quantity_remaining, 0)) as returned,
                SUM(COALESCE(ui.variance, 0)) as total_variance
            FROM truck_loads l
            JOIN trucks t ON l.truck_id = t.id
            JOIN load_items li ON l.id = li.load_id
            LEFT JOIN truck_unloads tu ON l.id = tu.load_id
            LEFT JOIN unload_items ui ON tu.id = ui.unload_id AND li.product_id = ui.product_id
            WHERE l.load_date BETWEEN ? AND ?
            GROUP BY l.id
        `, [dateFrom, dateTo]);

        // 2. Stock Trends (Daily In/Out)
        // Note: 'Out' is loaded to trucks, 'In' is remaining stock returned after unload
        const trends = await allQuery(`
            SELECT 
                load_date as label,
                SUM(li.quantity_loaded) as stock_out,
                (SELECT SUM(quantity_remaining) FROM truck_unloads tu JOIN unload_items ui ON tu.id = ui.unload_id WHERE tu.unload_date = l.load_date) as stock_in
            FROM truck_loads l
            JOIN load_items li ON l.id = li.load_id
            WHERE l.load_date BETWEEN ? AND ?
            GROUP BY l.load_date
            ORDER BY l.load_date ASC
        `, [dateFrom, dateTo]);

        // 3. Reorder Alerts (Using a heuristic since min_stock isn't in schema yet)
        // We'll show products where current movement is high but stock might be low
        // Actually, let's just query products with low 'initial_stock' for now as a placeholder
        // or products that are frequently out of stock (no sales in last 7 days despite being active)
        const reorderAlerts = await allQuery(`
            SELECT 
                p.name, p.initial_stock as current_stock,
                (SELECT SUM(quantity) FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE ii.product_id = p.id AND i.invoice_date > date('now', '-7 days')) as weekly_sales
            FROM products p
            WHERE p.status = 'active'
            ORDER BY initial_stock ASC
            LIMIT 10
        `);

        return {
            loadMetrics,
            trends,
            reorderAlerts
        };
    }

    async getDemandForecasting(dateFrom, dateTo) {
        // 1. Pre-order vs Actual Sales (Product-wise)
        const productDemand = await allQuery(`
            SELECT 
                p.name as label,
                SUM(COALESCE((SELECT SUM(poi.quantity) FROM pre_order_items poi JOIN pre_orders po ON poi.pre_order_id = po.id WHERE poi.product_id = p.id AND po.order_date BETWEEN ? AND ?), 0)) as pre_ordered,
                SUM(COALESCE((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE ii.product_id = p.id AND i.invoice_date BETWEEN ? AND ? AND i.status = 'completed'), 0)) as actual_sales
            FROM products p
            WHERE p.status = 'active'
            GROUP BY p.id
            HAVING pre_ordered > 0 OR actual_sales > 0
            ORDER BY pre_ordered DESC
            LIMIT 15
        `, [dateFrom, dateTo, dateFrom, dateTo]);

        // 2. Fulfillment and Backorder Rate
        const fulfillment = await getQuery(`
            SELECT 
                COUNT(*) as total_preorders,
                COUNT(CASE WHEN status = 'converted' THEN 1 END) as fulfilled_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as backorder_count,
                SUM(CASE WHEN status = 'pending' THEN total_amount ELSE 0 END) as lost_revenue_estimate
            FROM pre_orders
            WHERE order_date BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        // 3. Demand Forecast by Route
        const routeForecast = await allQuery(`
            SELECT 
                r.name as route_name,
                COUNT(DISTINCT po.id) as pre_order_count,
                SUM(po.total_amount) as demand_value
            FROM routes r
            JOIN customers c ON r.id = c.route_id
            JOIN pre_orders po ON c.id = po.customer_id
            WHERE po.order_date BETWEEN ? AND ?
            GROUP BY r.id
            ORDER BY demand_value DESC
        `, [dateFrom, dateTo]);

        // 4. Lead Time Analysis (Approximate: Avg time between pre-order and invoice for same customer)
        // Since we don't have a direct link, we'll look at the avg gap for converted orders or similar
        const leadTime = await getQuery(`
            SELECT AVG(ABS(julianday(i.invoice_date) - julianday(po.order_date))) as avg_lead_days
            FROM pre_orders po
            JOIN invoices i ON po.customer_id = i.customer_id 
            WHERE po.status = 'converted' 
              AND i.invoice_date >= po.order_date
              AND po.order_date BETWEEN ? AND ?
        `, [dateFrom, dateTo]);

        return {
            productDemand,
            fulfillment,
            routeForecast,
            leadTime: Math.round(leadTime.avg_lead_days || 0)
        };
    }

    async getSalesBySupplier(dateFrom, dateTo) {
        return allQuery(`
            SELECT 
                s.name as label,
                COUNT(i.id) as count,
                SUM(ii.line_total) as total
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            JOIN suppliers s ON p.supplier_id = s.id
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.status = 'completed'
              AND i.invoice_date BETWEEN ? AND ?
            GROUP BY s.id
            ORDER BY total DESC
        `, [dateFrom, dateTo]);
    }

    async getPaymentsAnalytics(dateFrom, dateTo) {
        return allQuery(`
            SELECT 
                payment_type as label,
                COUNT(*) as count,
                SUM(amount) as total
            FROM receipts
            WHERE receipt_date BETWEEN ? AND ?
            GROUP BY payment_type
            ORDER BY total DESC
        `, [dateFrom, dateTo]);
    }

    async getExpensesAnalytics(dateFrom, dateTo) {
        return allQuery(`
            SELECT 
                category as label,
                COUNT(*) as count,
                SUM(amount) as total
            FROM expenses
            WHERE date BETWEEN ? AND ?
            GROUP BY category
            ORDER BY total DESC
        `, [dateFrom, dateTo]);
    }

    async getCustomerBalanceSummary() {
        return allQuery(`
            SELECT 
                name as label,
                account_balance as total,
                status as label_secondary
            FROM customers
            WHERE account_balance > 0
            ORDER BY account_balance DESC
        `);
    }

    async getStockValue() {
        return allQuery(`
            SELECT 
                name as label,
                initial_stock as quantity,
                (initial_stock * cost) as total
            FROM products
            WHERE status = 'active'
              AND initial_stock > 0
            ORDER BY total DESC
        `);
    }

    async getLoadConsistency(dateFrom, dateTo) {
        return allQuery(`
            SELECT 
                t.registration_number as label,
                COUNT(l.id) as count,
                AVG((SELECT SUM(ii.quantity) FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.load_id = l.id) / li_total.total) * 100 as total
            FROM truck_loads l
            JOIN trucks t ON l.truck_id = t.id
            JOIN (SELECT load_id, SUM(quantity_loaded) as total FROM load_items GROUP BY load_id) li_total ON l.id = li_total.load_id
            WHERE l.load_date BETWEEN ? AND ?
            GROUP BY t.id
            ORDER BY total DESC
        `, [dateFrom, dateTo]);
    }

    async getProductDiscounts(dateFrom, dateTo, customerId = null) {
        let sql = `
            SELECT 
                ii.product_name as label,
                AVG(ii.discount_percentage) as discount_pct,
                SUM(ii.quantity) as quantity,
                SUM(ii.discount_amount) as total
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.status = 'completed'
              AND i.invoice_date BETWEEN ? AND ?
        `;
        let params = [dateFrom, dateTo];

        if (customerId) {
            sql += ` AND i.customer_id = ? `;
            params.push(customerId);
        }

        sql += `
            GROUP BY ii.product_id
            ORDER BY total DESC
        `;

        return allQuery(sql, params);
    }
}

module.exports = new AnalyticsRepository();

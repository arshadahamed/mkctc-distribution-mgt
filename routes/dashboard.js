const express = require('express');
const router = express.Router();
const { getDatabase, allQuery, getQuery, runQuery } = require('../lib/db');
const salesRepo = require('../repositories/salesRepo');
const paymentRepo = require('../repositories/paymentRepo');

// Middleware to check if user is admin
const expenseRepo = require('../repositories/expenseRepo');

const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { logEvent, logError } = require('../lib/logger');

// Get dashboard KPIs
router.get('/kpis', async (req, res) => {
    try {
        let today = req.query.date;
        if (!today) {
            const d = new Date();
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            today = `${yyyy}-${mm}-${dd}`;
        }
        console.log(`[Dashboard] Fetching KPIs for date: ${today}`);

        // Daily expenses
        const expenses = await expenseRepo.getTodayTotal(today);
        console.log(`[Dashboard] Total expenses for ${today}: ${expenses}`);

        // Advanced Sales (Daily, Monthly, YTD)
        const salesStats = await getQuery(`
            SELECT 
                SUM(CASE WHEN date(invoice_date) = date(?) THEN net_total ELSE 0 END) as daily_sales,
                SUM(CASE WHEN strftime('%Y-%m', invoice_date) = strftime('%Y-%m', ?) THEN net_total ELSE 0 END) as monthly_sales,
                SUM(CASE WHEN strftime('%Y', invoice_date) = strftime('%Y', ?) THEN net_total ELSE 0 END) as ytd_sales,
                SUM(CASE WHEN payment_method = 'cash' AND strftime('%Y', invoice_date) = strftime('%Y', ?) THEN net_total ELSE 0 END) as cash_sales,
                SUM(CASE WHEN payment_method = 'account' AND strftime('%Y', invoice_date) = strftime('%Y', ?) THEN net_total ELSE 0 END) as credit_sales
            FROM invoices
            WHERE status = 'completed'
        `, [today, today, today, today, today]);

        // Gross Profit (using current product cost as proxy)
        const profitStats = await getQuery(`
            SELECT 
                SUM(ii.line_total - (ii.quantity * p.cost)) as gross_profit
            FROM invoice_items ii
            JOIN products p ON ii.product_id = p.id
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.status = 'completed'
        `);

        // Total Expenses (YTD)
        const ytdExpenses = await getQuery(`
            SELECT SUM(amount) as total 
            FROM expenses 
            WHERE strftime('%Y', date) = strftime('%Y', ?)
        `, [today]);

        // Daily Collections
        const paymentSummary = await paymentRepo.getPaymentSummary({
            date_from: today,
            date_to: today
        });

        // Total outstanding
        const outstanding = await getQuery(`
            SELECT SUM(account_balance) as total_outstanding
            FROM customers
            WHERE status = 'active'
        `);

        // Active Customers
        const activeCustomers = await getQuery(`
            SELECT COUNT(*) as count FROM customers WHERE status = 'active'
        `);

        // Active trucks & Total trucks for utilization
        const activeTrucks = await getQuery(`
            SELECT COUNT(DISTINCT truck_id) as count
            FROM truck_loads
            WHERE status = 'loaded' AND date(load_date) = date(?)
        `, [today]);

        const totalTrucks = await getQuery(`SELECT COUNT(*) as count FROM trucks WHERE status = 'active'`);
        const utilization = totalTrucks.count > 0 ? (activeTrucks.count / totalTrucks.count) * 100 : 0;

        // Delivery Success Rate
        const deliveryStats = await getQuery(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
            FROM invoices
            WHERE load_id IS NOT NULL
        `);
        const successRate = deliveryStats.total > 0 ? (deliveryStats.completed / deliveryStats.total) * 100 : 0;

        // Route performance (today)
        const routePerformance = await allQuery(`
            SELECT 
                r.name as route_name,
                COUNT(DISTINCT i.id) as invoice_count,
                COALESCE(SUM(i.net_total), 0) as total_sales
            FROM routes r
            LEFT JOIN customers c ON r.id = c.route_id
            LEFT JOIN invoices i ON c.id = i.customer_id AND date(i.invoice_date) = date(?)
            GROUP BY r.id, r.name
            ORDER BY total_sales DESC
        `, [today]);

        const grossProfit = profitStats?.gross_profit || 0;
        const netProfit = grossProfit - (ytdExpenses?.total || 0);
        const margin = salesStats?.ytd_sales > 0 ? (grossProfit / salesStats.ytd_sales) * 100 : 0;

        res.json({
            success: true,
            data: {
                today_used: today,
                daily_sales: salesStats?.daily_sales || 0,
                monthly_sales: salesStats?.monthly_sales || 0,
                ytd_sales: salesStats?.ytd_sales || 0,
                cash_sales: salesStats?.cash_sales || 0,
                credit_sales: salesStats?.credit_sales || 0,
                gross_profit: grossProfit,
                net_profit: netProfit,
                profit_margin: margin,
                collections: paymentSummary?.total_net_collected || 0,
                outstanding: outstanding?.total_outstanding || 0,
                active_customers: activeCustomers?.count || 0,
                active_trucks: activeTrucks?.count || 0,
                vehicle_utilization: utilization,
                delivery_success_rate: successRate,
                expenses_ytd: ytdExpenses?.total || 0,
                route_performance: routePerformance || []
            }
        });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_DASHBOARD_KPIS', error);
        console.error('KPI Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recent activities
router.get('/activities', async (req, res) => {
    try {
        const limit = req.query.limit || 10;

        const activities = await allQuery(`
            SELECT 
                'sale' as type,
                i.invoice_number as reference,
                c.name as customer_name,
                i.net_total as amount,
                i.created_at as timestamp
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            UNION ALL
            SELECT 
                'payment' as type,
                r.receipt_number as reference,
                c.name as customer_name,
                (CASE WHEN r.receipt_category = 'return' THEN -r.amount ELSE r.amount END) as amount,
                r.created_at as timestamp
            FROM receipts r
            JOIN customers c ON r.customer_id = c.id
            ORDER BY timestamp DESC
            LIMIT ?
        `, [limit]);

        res.json({ success: true, data: activities || [] });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_DASHBOARD_ACTIVITIES', error);
        console.error('Activities Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get sales trend (last 7 days)
router.get('/trends/sales', async (req, res) => {
    try {
        const trends = await allQuery(`
            SELECT 
                invoice_date as date,
                COUNT(*) as invoice_count,
                SUM(net_total) as total_sales
            FROM invoices
            WHERE invoice_date >= date('now', '-7 days')
            GROUP BY invoice_date
            ORDER BY invoice_date
        `);

        res.json({ success: true, data: trends || [] });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_SALES_TRENDS', error);
        console.error('Trends Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get log statistics (Admin only)
router.get('/logs/stats', isAdmin, async (req, res) => {
    try {
        const stats = await getQuery(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN action = 'ERROR' THEN 1 ELSE 0 END) as errors,
                SUM(CASE WHEN action IN ('DELETE', 'UPDATE', 'CLEAR_LOGS', 'RESTORE_BACKUP', 'RESET_DATA') THEN 1 ELSE 0 END) as admin_actions,
                (SELECT u.name FROM audit_logs l JOIN users u ON l.user_id = u.id GROUP BY l.user_id ORDER BY COUNT(*) DESC LIMIT 1) as top_user
            FROM audit_logs
        `);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get system audit logs (Admin only)
router.get('/logs', isAdmin, async (req, res) => {
    try {
        const limit = req.query.limit || 100;
        const { query, action, dateFrom, dateTo } = req.query;

        let sql = `
            SELECT 
                l.*,
                u.name as user_name
            FROM audit_logs l
            LEFT JOIN users u ON l.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (query) {
            sql += ` AND (l.details LIKE ? OR l.table_name LIKE ? OR u.name LIKE ?)`;
            params.push(`%${query}%`, `%${query}%`, `%${query}%`);
        }

        if (action) {
            sql += ` AND l.action = ?`;
            params.push(action);
        }

        if (dateFrom) {
            sql += ` AND date(l.created_at) >= date(?)`;
            params.push(dateFrom);
        }

        if (dateTo) {
            sql += ` AND date(l.created_at) <= date(?)`;
            params.push(dateTo);
        }

        sql += ` ORDER BY l.created_at DESC LIMIT ?`;
        params.push(Number(limit));

        const logs = await allQuery(sql, params);

        res.json({ success: true, data: logs || [] });
    } catch (error) {
        await logError(req.user?.id || 0, 'GET_AUDIT_LOGS', error);
        console.error('Logs Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Clear system audit logs (Admin only)
router.delete('/logs', isAuthenticated, isAdmin, async (req, res) => {
    try {
        await runQuery('DELETE FROM audit_logs');
        const userId = req.user?.id || 0;
        await logEvent(userId, 'CLEAR_LOGS', 'audit_logs', 0, `Administrator cleared all audit logs`);
        res.json({ success: true, message: 'All logs have been cleared' });
    } catch (error) {
        await logError(req.user?.id || 0, 'CLEAR_LOGS', error);
        console.error('Clear Logs Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

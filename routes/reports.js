const express = require('express');
const router = express.Router();
const analyticsRepo = require('../repositories/analyticsRepo');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { logError } = require('../lib/logger');

router.use(isAuthenticated, isAdmin);

router.get('/sales-analytics', async (req, res) => {
    try {
        const { dateFrom, dateTo, type, groupBy } = req.query;

        if (!dateFrom || !dateTo) {
            return res.status(400).json({ success: false, error: 'Date range is required' });
        }

        let data;
        switch (type) {
            case 'date':
                data = await analyticsRepo.getSalesByDate(dateFrom, dateTo, groupBy);
                break;
            case 'customer':
                data = await analyticsRepo.getSalesByCustomer(dateFrom, dateTo);
                break;
            case 'supplier':
                data = await analyticsRepo.getSalesBySupplier(dateFrom, dateTo);
                break;
            case 'payments':
                data = await analyticsRepo.getPaymentsAnalytics(dateFrom, dateTo);
                break;
            case 'expenses':
                data = await analyticsRepo.getExpensesAnalytics(dateFrom, dateTo);
                break;
            case 'debtors':
                data = await analyticsRepo.getCustomerBalanceSummary();
                break;
            case 'route':
                data = await analyticsRepo.getSalesByRoute(dateFrom, dateTo);
                break;
            case 'sales_rep':
                data = await analyticsRepo.getSalesBySalesRep(dateFrom, dateTo);
                break;
            case 'vehicle':
                data = await analyticsRepo.getSalesByVehicle(dateFrom, dateTo);
                break;
            case 'top_products':
                data = await analyticsRepo.getTopProducts(dateFrom, dateTo, req.query.limit || 10);
                break;
            case 'low_products':
                data = await analyticsRepo.getLowSellingProducts(dateFrom, dateTo, req.query.limit || 10);
                break;
            case 'avg_order':
                data = await analyticsRepo.getAverageOrderValue(dateFrom, dateTo);
                break;
            case 'repeat_rate':
                data = await analyticsRepo.getRepeatCustomerRate(dateFrom, dateTo);
                break;
            case 'discount_impact':
                data = await analyticsRepo.getDiscountImpactAnalysis(dateFrom, dateTo);
                break;
            case 'summary':
                // Special case to get multiple stats for a summary view
                const [avgOrder, repeatRate, discountImpact] = await Promise.all([
                    analyticsRepo.getAverageOrderValue(dateFrom, dateTo),
                    analyticsRepo.getRepeatCustomerRate(dateFrom, dateTo),
                    analyticsRepo.getDiscountImpactAnalysis(dateFrom, dateTo)
                ]);
                data = { avgOrder, repeatRate, discountImpact };
                break;
            case 'customer':
                data = await analyticsRepo.getSalesByCustomer(dateFrom, dateTo, req.query.limit || 20);
                break;
            case 'payments':
                data = await analyticsRepo.getPaymentsAnalytics(dateFrom, dateTo);
                break;
            case 'inventory':
                data = await analyticsRepo.getStockValue();
                break;
            case 'load_consistency':
                data = await analyticsRepo.getLoadConsistency(dateFrom, dateTo);
                break;
            case 'customer_intelligence':
                data = await analyticsRepo.getCustomerIntelligence(dateFrom, dateTo);
                break;
            case 'inventory_intelligence':
                data = await analyticsRepo.getInventoryIntelligence(dateFrom, dateTo);
                break;
            case 'demand_forecast':
                data = await analyticsRepo.getDemandForecasting(dateFrom, dateTo);
                break;
            case 'product_discounts':
                data = await analyticsRepo.getProductDiscounts(dateFrom, dateTo, req.query.customerId);
                break;
            default:
                return res.status(400).json({ success: false, error: 'Invalid report type' });
        }

        res.json({ success: true, data });
    } catch (error) {
        await logError(req.user.id, 'REPORT_FETCH_ERROR', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

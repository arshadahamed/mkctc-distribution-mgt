const { transaction, runQuery, allQuery, getQuery } = require('../lib/db');
const customerRepo = require('./customerRepo');

class SalesRepository {
    async createInvoice(invoiceData) {
        if (!invoiceData.customer_id || invoiceData.customer_id === '') {
            console.error('FAILED_CREATE_INVOICE: Missing customer_id', invoiceData);
            throw new Error('Customer ID is required to create an invoice');
        }

        return await transaction(async () => {
            const invoiceNumber = await this.generateInvoiceNumber();

            // Insert invoice
            const invoiceSql = `
                INSERT INTO invoices (invoice_number, invoice_date, customer_id, bill_discount, tax, net_total, payment_method, status, load_id, created_by, payment_details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const invoiceParams = [
                invoiceNumber, invoiceData.invoice_date, invoiceData.customer_id,
                invoiceData.bill_discount || 0, invoiceData.tax || 0, invoiceData.net_total,
                invoiceData.payment_method, invoiceData.status || 'completed',
                invoiceData.load_id || null, invoiceData.created_by,
                invoiceData.payment_details ? JSON.stringify(invoiceData.payment_details) : null
            ];

            const invoiceResult = await runQuery(invoiceSql, invoiceParams);
            const invoiceId = invoiceResult.lastID;

            // Insert invoice items
            for (const item of invoiceData.items) {
                const itemSql = `
                    INSERT INTO invoice_items (invoice_id, product_id, product_name, batch_number, msrp, discount_percentage, discount_amount, quantity, is_free, line_total)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const itemParams = [
                    invoiceId, item.product_id, item.product_name, item.batch_number || null, item.msrp,
                    item.discount_percentage || 0, item.discount_amount || 0,
                    item.quantity, item.is_free ? 1 : 0, item.line_total
                ];
                await runQuery(itemSql, itemParams);

                // Update customer-wise product discount memory
                if (item.discount_percentage > 0 || item.discount_amount > 0) {
                    await this.updateCustomerProductDiscount(
                        invoiceData.customer_id,
                        item.product_id,
                        item.selected_price_id || 0,
                        item.discount_percentage || 0,
                        item.discount_amount || 0
                    );
                }
            }

            // Handle cheque details if applicable (for 'cheque' or 'split' method)
            if (invoiceData.payment_method === 'cheque' || invoiceData.payment_method === 'split') {
                const details = typeof invoiceData.payment_details === 'string' ? JSON.parse(invoiceData.payment_details) : invoiceData.payment_details;

                if (details && details.cheques && Array.isArray(details.cheques)) {
                    // MULTIPLE CHEQUES HANDLE
                    const chequeSql = `
                        INSERT INTO cheque_details (invoice_id, cheque_number, cheque_date, bank_name, amount, cheque_image)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    for (const chq of details.cheques) {
                        await runQuery(chequeSql, [
                            invoiceId, chq.number || chq.cheque_number, chq.date || chq.cheque_date,
                            chq.bank_name || chq.bank, chq.amount, chq.image || chq.cheque_image || null
                        ]);
                    }
                } else if (invoiceData.cheque) {
                    // FALLBACK FOR SINGLE CHEQUE (OLD DATA/DIRECT)
                    const chequeSql = `
                        INSERT INTO cheque_details (invoice_id, cheque_number, cheque_date, bank_name, amount, cheque_image)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `;
                    const chequeAmount = invoiceData.cheque.amount || invoiceData.net_total;
                    await runQuery(chequeSql, [
                        invoiceId, invoiceData.cheque.number || invoiceData.cheque.cheque_number,
                        invoiceData.cheque.date || invoiceData.cheque.cheque_date,
                        invoiceData.cheque.bank_name || invoiceData.cheque.bank, chequeAmount,
                        invoiceData.cheque.image || invoiceData.cheque.cheque_image || null
                    ]);
                }
            }

            // Update customer balance if payment is on account or has a credit portion in split
            if (invoiceData.payment_method === 'account') {
                await customerRepo.updateBalance(invoiceData.customer_id, invoiceData.net_total);
            } else if (invoiceData.payment_method === 'split' && invoiceData.payment_details && invoiceData.payment_details.credit > 0) {
                await customerRepo.updateBalance(invoiceData.customer_id, invoiceData.payment_details.credit);
            }

            return invoiceId;
        });
    }

    async generateInvoiceNumber() {
        const date = new Date();
        const yearMonth = date.getFullYear().toString().slice(-2) +
            (date.getMonth() + 1).toString().padStart(2, '0');

        const lastInvoice = await getQuery('SELECT invoice_number FROM invoices ORDER BY id DESC LIMIT 1');

        let sequence = '0001';
        if (lastInvoice && lastInvoice.invoice_number.startsWith('INV' + yearMonth)) {
            const lastSeq = parseInt(lastInvoice.invoice_number.slice(-4));
            sequence = (lastSeq + 1).toString().padStart(4, '0');
        }

        return `INV${yearMonth}${sequence}`;
    }

    async getAll(filters = {}) {
        let query = `
            SELECT i.*, c.name as customer_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.customer_id) {
            query += ' AND i.customer_id = ?';
            params.push(filters.customer_id);
        }

        if (filters.date_from) {
            query += ' AND i.invoice_date >= ?';
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            query += ' AND i.invoice_date <= ?';
            params.push(filters.date_to);
        }

        query += ' ORDER BY i.id DESC';
        return await allQuery(query, params);
    }

    async getById(id) {
        const invoice = await getQuery(`
            SELECT i.*, c.name as customer_name, c.address as customer_address
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.id = ?
        `, [id]);

        if (invoice) {
            invoice.items = await allQuery('SELECT * FROM invoice_items WHERE invoice_id = ?', [id]);

            // Fetch cheque details if any
            const cheques = await allQuery('SELECT cheque_number as number, cheque_date as date, bank_name as bank, amount, cheque_image as image FROM cheque_details WHERE invoice_id = ?', [id]);
            invoice.cheques = cheques || [];
            if (cheques && cheques.length > 0) {
                invoice.cheque = cheques[0]; // Fallback for old code
            }
        }

        return invoice;
    }

    async getSalesSummary(filters = {}) {
        let query = `
            SELECT 
                COUNT(*) as invoice_count,
                SUM(net_total) as total_sales,
                SUM(CASE WHEN payment_method = 'cash' THEN net_total ELSE 0 END) as cash_sales,
                SUM(CASE WHEN payment_method = 'account' THEN net_total ELSE 0 END) as credit_sales
            FROM invoices
            WHERE status = 'completed'
        `;
        const params = [];

        if (filters.date_from) {
            query += ' AND invoice_date >= ?';
            params.push(filters.date_from);
        }

        if (filters.date_to) {
            query += ' AND invoice_date <= ?';
            params.push(filters.date_to);
        }

        return await getQuery(query, params);
    }
    async updateStatus(id, status) {
        return await runQuery('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);
    }

    async updateInvoice(id, invoiceData) {
        return await transaction(async () => {
            // Delete existing items
            await runQuery('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

            // Update invoice header
            const sql = `
                UPDATE invoices 
                SET invoice_date = ?, customer_id = ?, bill_discount = ?, tax = ?, 
                    net_total = ?, payment_method = ?, status = ?, load_id = ?, payment_details = ?
                WHERE id = ?
            `;
            const params = [
                invoiceData.invoice_date, invoiceData.customer_id, invoiceData.bill_discount || 0,
                invoiceData.tax || 0, invoiceData.net_total, invoiceData.payment_method,
                invoiceData.status || 'completed', invoiceData.load_id || null,
                invoiceData.payment_details ? JSON.stringify(invoiceData.payment_details) : null,
                id
            ];
            await runQuery(sql, params);

            // Insert new invoice items
            for (const item of invoiceData.items) {
                const itemSql = `
                    INSERT INTO invoice_items (invoice_id, product_id, product_name, batch_number, msrp, discount_percentage, discount_amount, quantity, is_free, line_total)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const itemParams = [
                    id, item.product_id, item.product_name, item.batch_number || null, item.msrp,
                    item.discount_percentage || 0, item.discount_amount || 0,
                    item.quantity, item.is_free ? 1 : 0, item.line_total
                ];
                await runQuery(itemSql, itemParams);
            }

            // Sync cheque details
            await runQuery('DELETE FROM cheque_details WHERE invoice_id = ?', [id]);
            if ((invoiceData.payment_method === 'cheque' || invoiceData.payment_method === 'split') && invoiceData.cheque) {
                const chequeSql = `
                    INSERT INTO cheque_details (invoice_id, cheque_number, cheque_date, bank_name, amount, cheque_image)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                const chequeAmount = invoiceData.cheque.amount || invoiceData.net_total;
                const chequeParams = [
                    id, invoiceData.cheque.number || invoiceData.cheque.cheque_number,
                    invoiceData.cheque.date || invoiceData.cheque.cheque_date,
                    invoiceData.cheque.bank_name || invoiceData.cheque.bank, chequeAmount,
                    invoiceData.cheque.image || invoiceData.cheque.cheque_image || null
                ];
                await runQuery(chequeSql, chequeParams);
            }

            // Handle balance update if it's now completed and on account
            // Handle balance update if it's now completed
            if (invoiceData.status === 'completed') {
                if (invoiceData.payment_method === 'account') {
                    await customerRepo.updateBalance(invoiceData.customer_id, invoiceData.net_total);
                } else if (invoiceData.payment_method === 'split' && invoiceData.payment_details && invoiceData.payment_details.credit > 0) {
                    await customerRepo.updateBalance(invoiceData.customer_id, invoiceData.payment_details.credit);
                }
            }

            return id;
        });
    }
    async deleteInvoice(id) {
        return await transaction(async () => {
            // Get invoice details first for balance reversal if needed
            const invoice = await this.getById(id);
            if (!invoice) return false;

            // Reverse customer balance if applicable
            if (invoice.status === 'completed') {
                if (invoice.payment_method === 'account') {
                    await customerRepo.updateBalance(invoice.customer_id, -invoice.net_total);
                } else if (invoice.payment_method === 'split' && invoice.payment_details) {
                    try {
                        const details = JSON.parse(invoice.payment_details);
                        if (details.credit > 0) {
                            await customerRepo.updateBalance(invoice.customer_id, -details.credit);
                        }
                    } catch (e) {
                        console.error('Error parsing payment_details during deletion:', e);
                    }
                }
            }

            // Delete items
            await runQuery('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);

            // Delete cheque details
            await runQuery('DELETE FROM cheque_details WHERE invoice_id = ?', [id]);

            // Delete invoice
            await runQuery('DELETE FROM invoices WHERE id = ?', [id]);

            return true;
        });
    }
    async createPreOrder(orderData) {
        return await transaction(async () => {
            const orderNumber = await this.generatePreOrderNumber();
            const sql = `
                INSERT INTO pre_orders (order_number, customer_id, order_date, total_amount, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            const params = [
                orderNumber, orderData.customer_id, orderData.order_date,
                orderData.total_amount, 'pending', orderData.created_by
            ];
            const result = await runQuery(sql, params);
            const orderId = result.lastID;

            for (const item of orderData.items) {
                const itemSql = `
                    INSERT INTO pre_order_items (pre_order_id, product_id, quantity, price, line_total)
                    VALUES (?, ?, ?, ?, ?)
                `;
                await runQuery(itemSql, [orderId, item.product_id, item.quantity, item.price, item.line_total]);
            }
            return orderId;
        });
    }

    async generatePreOrderNumber() {
        const date = new Date();
        const yearMonth = date.getFullYear().toString().slice(-2) +
            (date.getMonth() + 1).toString().padStart(2, '0');
        const lastOrder = await getQuery('SELECT order_number FROM pre_orders ORDER BY id DESC LIMIT 1');
        let sequence = '0001';
        if (lastOrder && lastOrder.order_number.startsWith('PR' + yearMonth)) {
            const lastSeq = parseInt(lastOrder.order_number.slice(-4));
            sequence = (lastSeq + 1).toString().padStart(4, '0');
        }
        return `PR${yearMonth}${sequence}`;
    }

    async getAllPreOrders(filters = {}) {
        let query = `
            SELECT po.*, c.name as customer_name
            FROM pre_orders po
            JOIN customers c ON po.customer_id = c.id
            WHERE 1=1
        `;
        const params = [];
        if (filters.status) {
            query += ' AND po.status = ?';
            params.push(filters.status);
        }
        query += ' ORDER BY po.id DESC';
        return await allQuery(query, params);
    }

    async getPreOrderById(id) {
        const order = await getQuery(`
            SELECT po.*, c.name as customer_name
            FROM pre_orders po
            JOIN customers c ON po.customer_id = c.id
            WHERE po.id = ?
        `, [id]);
        if (order) {
            order.items = await allQuery(`
                SELECT poi.*, p.name as product_name, p.unit, p.units_per_carton, p.weighted
                FROM pre_order_items poi
                JOIN products p ON poi.product_id = p.id
                WHERE poi.pre_order_id = ?
            `, [id]);
        }
        return order;
    }

    async updatePreOrderStatus(id, status) {
        return await runQuery('UPDATE pre_orders SET status = ? WHERE id = ?', [status, id]);
    }

    async deletePreOrder(id) {
        return await transaction(async () => {
            await runQuery('DELETE FROM pre_order_items WHERE pre_order_id = ?', [id]);
            await runQuery('DELETE FROM pre_orders WHERE id = ?', [id]);
            return true;
        });
    }

    async getCustomerProductDiscounts(customerId) {
        return await allQuery('SELECT product_id, price_id, discount_percentage, discount_amount FROM customer_product_discounts WHERE customer_id = ?', [customerId]);
    }

    async getProductDiscountForCustomer(customerId, productId, priceId = 0) {
        return await getQuery('SELECT discount_percentage, discount_amount FROM customer_product_discounts WHERE customer_id = ? AND product_id = ? AND price_id = ?', [customerId, productId, priceId || 0]);
    }

    async updateCustomerProductDiscount(customerId, productId, priceId, percentage, amount) {
        const sql = `
            INSERT OR REPLACE INTO customer_product_discounts (customer_id, product_id, price_id, discount_percentage, discount_amount, last_updated)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return await runQuery(sql, [customerId, productId, priceId || 0, percentage, amount]);
    }
}

module.exports = new SalesRepository();

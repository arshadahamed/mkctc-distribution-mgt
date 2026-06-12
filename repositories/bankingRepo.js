const { allQuery, getQuery, runQuery, transaction } = require('../lib/db');
const customerRepo = require('./customerRepo');

class BankingRepository {
    async getAllCheques() {
        const query = `
            SELECT 
                cd.id,
                cd.cheque_number,
                cd.cheque_date,
                cd.bank_name,
                cd.amount,
                cd.status,
                cd.remarks,
                cust.name as customer_name,
                r.receipt_number,
                i.invoice_number
            FROM cheque_details cd
        LEFT JOIN receipts r ON cd.receipt_id = r.id
        LEFT JOIN invoices i ON cd.invoice_id = i.id
        LEFT JOIN customers cust ON cust.id = COALESCE(r.customer_id, i.customer_id)
        ORDER BY cd.cheque_date DESC
        `;
        return await allQuery(query, []);
    }

    async updateChequeStatus(id, status, remarks) {
        return await transaction(async () => {
            // 1. Get current cheque info with customer_id
            const cheque = await getQuery(`
                SELECT cd.*, COALESCE(r.customer_id, i.customer_id) as customer_id 
                FROM cheque_details cd 
                LEFT JOIN receipts r ON cd.receipt_id = r.id 
                LEFT JOIN invoices i ON cd.invoice_id = i.id 
                WHERE cd.id = ?
            `, [id]);

            if (!cheque) throw new Error('Cheque not found');

            const oldStatus = cheque.status;
            const newStatus = status;
            const customerId = cheque.customer_id;
            const amount = cheque.amount;

            // 2. Adjust balance if moving TO or FROM 'Returned'
            if (customerId) {
                // If it becomes Returned, it increases the debt (balance is positive debt)
                if (newStatus === 'Returned' && oldStatus !== 'Returned') {
                    await customerRepo.updateBalance(customerId, amount);
                }
                // If it WAS Returned but is fixed/re-deposited now, decrease debt back to initial hopeful state
                else if (oldStatus === 'Returned' && newStatus !== 'Returned') {
                    await customerRepo.updateBalance(customerId, -amount);
                }
            }

            // 3. Update the record
            const query = `UPDATE cheque_details SET status = ?, remarks = ? WHERE id = ?`;
            await runQuery(query, [status, remarks, id]);
            return true;
        });
    }

    async getChequeStats() {
        const query = `
            SELECT
                SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END) as pending_total,
                COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_count,
                SUM(CASE WHEN status = 'Deposited' THEN amount ELSE 0 END) as deposited_total,
                COUNT(CASE WHEN status = 'Deposited' THEN 1 END) as deposited_count,
                SUM(CASE WHEN status = 'Cleared' THEN amount ELSE 0 END) as cleared_total,
                COUNT(CASE WHEN status = 'Cleared' THEN 1 END) as cleared_count,
                SUM(CASE WHEN status = 'Returned' THEN amount ELSE 0 END) as returned_total,
                COUNT(CASE WHEN status = 'Returned' THEN 1 END) as returned_count
            FROM cheque_details
        `;
        return await getQuery(query, []);
    }
}

module.exports = new BankingRepository();

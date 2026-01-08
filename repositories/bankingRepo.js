const { allQuery, getQuery, runQuery } = require('../lib/db');

class BankingRepository {
    getAllCheques() {
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
        return allQuery(query, []);
    }

    updateChequeStatus(id, status, remarks) {
        const query = `UPDATE cheque_details SET status = ?, remarks = ? WHERE id = ?`;
        return runQuery(query, [status, remarks, id]);
    }

    getChequeStats() {
        const query = `
            SELECT 
                SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END) as pending_total,
                COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_count,
                SUM(CASE WHEN status = 'Deposited' THEN amount ELSE 0 END) as deposited_total,
                COUNT(CASE WHEN status = 'Deposited' THEN 1 END) as deposited_count,
                SUM(CASE WHEN status = 'Returned' THEN amount ELSE 0 END) as returned_total,
                 COUNT(CASE WHEN status = 'Returned' THEN 1 END) as returned_count
            FROM cheque_details
        `;
        return getQuery(query, []);
    }
}

module.exports = new BankingRepository();

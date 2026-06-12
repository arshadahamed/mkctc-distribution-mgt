const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const settingsRepo = require('../repositories/settingsRepo');
const { logEvent, logError } = require('../lib/logger');
const { walCheckpoint } = require('../lib/db');

const DB_PATH = path.join(__dirname, '..', 'agro_distribution.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure backup dir exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

class BackupService {
    constructor() {
        this.task = null;
        this.checkpointTask = null;
    }

    async initScheduler() {
        try {
            const enabled = await settingsRepo.getSetting('backup_enabled');
            if (enabled !== 'true') {
                if (this.task) this.task.stop();
                console.log('🔄 Backup Scheduler: Disabled');
                return;
            }

            const frequency = await settingsRepo.getSetting('backup_frequency') || 'daily';
            const time = await settingsRepo.getSetting('backup_time') || '23:00'; // HH:MM

            const [hour, minute] = time.split(':');

            let cronExpression = `${minute} ${hour} * * *`; // Daily default

            if (frequency === 'weekly') {
                cronExpression = `${minute} ${hour} * * 0`; // Sunday
            } else if (frequency === 'monthly') {
                cronExpression = `${minute} ${hour} 1 * *`; // 1st of month
            }

            if (this.task) this.task.stop();

            this.task = cron.schedule(cronExpression, () => {
                console.log('⏰ Scheduled Backup Starting...');
                this.performBackup('scheduled');
            });

            console.log(`✅ Backup Scheduler started: ${frequency} at ${time} (${cronExpression})`);
        } catch (error) {
            console.error('Failed to init backup scheduler:', error);
        }

        // Hourly WAL checkpoint so the -wal file stays small during the day
        // (independent of the backup-enabled setting).
        if (!this.checkpointTask) {
            this.checkpointTask = cron.schedule('0 * * * *', async () => {
                const r = await walCheckpoint();
                if (r) console.log('🧹 Hourly WAL checkpoint:', JSON.stringify(r));
            });
            console.log('✅ Hourly WAL checkpoint task started');
        }
    }

    async performBackup(type = 'manual', userId = 0) {
        try {
            const date = new Date();
            const timestamp = date.toISOString().replace(/[:.]/g, '-');
            const fileName = `backup_${type}_${timestamp}.db`;
            const destPath = path.join(BACKUP_DIR, fileName);

            // Flush the WAL into the main .db FIRST, otherwise the copy can miss
            // recently committed transactions still sitting in the -wal file.
            await walCheckpoint();

            // Copy File
            await fs.promises.copyFile(DB_PATH, destPath);

            // Log
            await logEvent(userId, 'BACKUP_CREATED', 'system', 0, `Backup created successfully (${type})`);
            console.log(`📦 Backup created: ${fileName}`);

            // Prune Old Backups
            await this.pruneBackups();

            return { success: true, fileName, path: destPath };
        } catch (error) {
            console.error('Backup failed:', error);
            await logError(userId, 'BACKUP_FAILED', error);
            return { success: false, error: error.message };
        }
    }

    async pruneBackups() {
        try {
            const retention = parseInt(await settingsRepo.getSetting('backup_retention') || '10');
            const files = await fs.promises.readdir(BACKUP_DIR);

            const backups = files
                .filter(f => f.endsWith('.db') && f.startsWith('backup_'))
                .map(f => ({
                    name: f,
                    time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            if (backups.length > retention) {
                const toDelete = backups.slice(retention);
                for (const file of toDelete) {
                    await fs.promises.unlink(path.join(BACKUP_DIR, file.name));
                    console.log(`🗑️ Pruned old backup: ${file.name}`);
                }
            }
        } catch (error) {
            console.error('Backup pruning failed:', error);
        }
    }

    async listBackups() {
        const files = await fs.promises.readdir(BACKUP_DIR);
        return files
            .filter(f => f.endsWith('.db') && f.startsWith('backup_'))
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    name: f,
                    size: stats.size,
                    created_at: stats.mtime
                };
            })
            .sort((a, b) => b.created_at - a.created_at);
    }
}

module.exports = new BackupService();

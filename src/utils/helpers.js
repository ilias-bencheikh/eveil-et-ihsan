const crypto = require('crypto');

// Générer un token aléatoire
function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

// Générer un ID unique basé sur timestamp
function generateId(prefix = '') {
    const timestamp = Date.now().toString();
    return prefix ? `${prefix}_${timestamp}` : timestamp;
}

// Obtenir l'adresse IP locale
function getLocalIpAddress() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

// Formater une date
function formatDate(date = new Date()) {
    return date.toISOString();
}

// Valider un email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Promisifier les méthodes SQLite
function dbRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = {
    generateToken,
    generateId,
    getLocalIpAddress,
    formatDate,
    isValidEmail,
    dbRun,
    dbGet,
    dbAll
};

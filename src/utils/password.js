/**
 * Utilitaires de hashage de mots de passe
 * Utilise bcrypt pour un hashage sécurisé
 */

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12; // Coût du hashage (12 est un bon compromis sécurité/performance)

/**
 * Hasher un mot de passe en clair
 * @param {string} plainPassword - Le mot de passe en clair
 * @returns {Promise<string>} Le mot de passe hashé
 */
async function hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Vérifier un mot de passe contre son hash
 * @param {string} plainPassword - Le mot de passe en clair à vérifier
 * @param {string} hashedPassword - Le hash stocké en base
 * @returns {Promise<boolean>} true si le mot de passe correspond
 */
async function verifyPassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) return false;
    
    // Compatibilité : si le mot de passe stocké n'est pas un hash bcrypt,
    // on compare en clair (pour la migration des anciens comptes)
    if (!hashedPassword.startsWith('$2b$') && !hashedPassword.startsWith('$2a$')) {
        return plainPassword === hashedPassword;
    }
    
    return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Vérifier si un mot de passe est déjà hashé avec bcrypt
 * @param {string} password - Le mot de passe à vérifier
 * @returns {boolean}
 */
function isHashed(password) {
    return password && (password.startsWith('$2b$') || password.startsWith('$2a$'));
}

module.exports = {
    hashPassword,
    verifyPassword,
    isHashed,
    SALT_ROUNDS
};

const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuration du transporteur d'email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'no.reply.eveil.et.ihsan@gmail.com',
        pass: process.env.EMAIL_PASSWORD || ''
    }
});

// Templates d'emails
const emailTemplates = {
    activation: (userName, activationLink) => ({
        subject: 'Activation de votre compte - Eveil et Ihsan',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Eveil et Ihsan</h1>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #1e3a5f;">Salam Aleykoum ${userName},</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Votre compte a été créé avec succès. Pour activer votre compte et créer votre mot de passe, 
                        veuillez cliquer sur le bouton ci-dessous :
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${activationLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">
                            Activer mon compte
                        </a>
                    </div>
                    <p style="color: #999; font-size: 0.9em; line-height: 1.6;">
                        Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                        <span style="color: #667eea; word-break: break-all;">${activationLink}</span>
                    </p>
                    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                    <p style="color: #999; font-size: 0.85em; text-align: center;">
                        Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                    </p>
                </div>
            </div>
        `
    }),

    resetPassword: (userName, resetLink) => ({
        subject: 'Réinitialisation de votre mot de passe - Eveil et Ihsan',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Eveil et Ihsan</h1>
                </div>
                <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #1e3a5f;">Bonjour ${userName},</h2>
                    <p style="color: #666; line-height: 1.6;">
                        Vous avez demandé la réinitialisation de votre mot de passe. 
                        Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; display: inline-block;">
                            Réinitialiser mon mot de passe
                        </a>
                    </div>
                    <p style="color: #999; font-size: 0.9em; line-height: 1.6;">
                        Ce lien est valable pendant 1 heure.<br>
                        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
                    </p>
                    <p style="color: #999; font-size: 0.9em; line-height: 1.6;">
                        Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
                        <span style="color: #667eea; word-break: break-all;">${resetLink}</span>
                    </p>
                    <hr style="border: none; border-top: 1px solid #dee2e6; margin: 20px 0;">
                    <p style="color: #999; font-size: 0.85em; text-align: center;">
                        Cet email a été envoyé automatiquement, merci de ne pas y répondre.
                    </p>
                </div>
            </div>
        `
    })
};

// Fonction d'envoi d'email
async function sendEmail(to, template, ...args) {
    const emailContent = emailTemplates[template](...args);
    
    const mailOptions = {
        from: `Eveil et Ihsan <${process.env.EMAIL_USER || 'no.reply.eveil.et.ihsan@gmail.com'}>`,
        to,
        subject: emailContent.subject,
        html: emailContent.html
    };

    return transporter.sendMail(mailOptions);
}

module.exports = {
    transporter,
    sendEmail,
    emailTemplates
};

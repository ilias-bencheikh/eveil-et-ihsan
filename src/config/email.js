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
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Activation de compte - Eveil et Ihsan</title>
                <style>
                    body {
                        font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #f8f9ff;
                        color: #191c20;
                        line-height: 1.6;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    .email-header {
                        background-color: #5c9ded;
                        padding: 30px;
                        text-align: center;
                        color: white;
                    }
                    .email-header h1 {
                        margin: 0;
                        font-size: 24px;
                        font-weight: 500;
                        letter-spacing: 0.5px;
                    }
                    .email-body {
                        padding: 40px 30px;
                        background-color: #ffffff;
                    }
                    .email-body h2 {
                        color: #5c9ded;
                        font-size: 20px;
                        font-weight: 500;
                        margin-top: 0;
                        margin-bottom: 20px;
                    }
                    .email-body p {
                        color: #43474e;
                        font-size: 16px;
                        line-height: 1.7;
                        margin-bottom: 20px;
                    }
                    .cta-button {
                        display: inline-block;
                        background-color: #5c9ded;
                        color: white;
                        padding: 14px 28px;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: 500;
                        font-size: 16px;
                        text-align: center;
                        margin: 25px 0;
                        transition: background-color 0.3s ease;
                    }
                    .cta-button:hover {
                        background-color: #4a90e2;
                    }
                    .link-box {
                        background-color: #f0f7ff;
                        padding: 16px;
                        border-radius: 6px;
                        border: 1px solid #b3d9ff;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        color: #5c9ded;
                        word-break: break-all;
                        margin: 20px 0;
                    }
                    .info-box {
                        background-color: #e3f2fd;
                        border: 1px solid #90caf9;
                        border-radius: 6px;
                        padding: 16px;
                        margin: 20px 0;
                    }
                    .info-box p {
                        margin: 0;
                        color: #1976d2;
                        font-weight: 500;
                    }
                    .divider {
                        border: none;
                        border-top: 1px solid #e0e2ec;
                        margin: 30px 0;
                    }
                    .footer {
                        text-align: center;
                        color: #666;
                        font-size: 14px;
                        padding: 20px 30px;
                        background-color: #f8f9ff;
                        border-top: 1px solid #e0e2ec;
                    }
                    .footer p {
                        margin: 5px 0;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="email-header">
                        <h1>Eveil et Ihsan</h1>
                    </div>
                    <div class="email-body">
                        <h2>Salam Aleykoum ${userName},</h2>
                        <p>
                            Votre compte a été créé avec succès sur la plateforme de gestion scolaire <strong>Eveil et Ihsan</strong>.
                            Pour finaliser votre inscription et accéder à votre espace personnel, veuillez activer votre compte.
                        </p>

                        <div style="text-align: center;">
                            <a href="${activationLink}" class="cta-button">
                                Activer mon compte
                            </a>
                        </div>

                        <div class="info-box">
                            <p>
                                <strong>Instructions :</strong><br>
                                • Cliquez sur le bouton "Activer mon compte"<br>
                                • Définissez votre mot de passe<br>
                                • Connectez-vous à votre compte
                            </p>
                        </div>

                        <p>
                            Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
                        </p>
                        <div class="link-box">
                            ${activationLink}
                        </div>

                        <hr class="divider">

                        <p style="font-size: 14px; color: #666;">
                            <strong>Informations importantes :</strong><br>
                            • Ce lien d'activation est personnel et confidentiel<br>
                            • Il expire automatiquement après utilisation<br>
                            • Pour toute question, contactez l'administration
                        </p>
                    </div>
                    <div class="footer">
                        <p>
                            Cet email a été envoyé automatiquement par le système de gestion Eveil et Ihsan
                        </p>
                        <p style="font-size: 12px;">
                            © 2025 Eveil et Ihsan - Système de gestion scolaire
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    resetPassword: (userName, resetLink) => ({
        subject: 'Réinitialisation de votre mot de passe - Eveil et Ihsan',
        html: `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Réinitialisation de mot de passe - Eveil et Ihsan</title>
                <style>
                    body {
                        font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #f8f9ff;
                        color: #191c20;
                        line-height: 1.6;
                    }
                    .email-container {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    }
                    .email-header {
                        background-color: #ffb74d;
                        padding: 30px;
                        text-align: center;
                        color: white;
                    }
                    .email-header h1 {
                        margin: 0;
                        font-size: 24px;
                        font-weight: 500;
                        letter-spacing: 0.5px;
                    }
                    .email-body {
                        padding: 40px 30px;
                        background-color: #ffffff;
                    }
                    .email-body h2 {
                        color: #ffb74d;
                        font-size: 20px;
                        font-weight: 500;
                        margin-top: 0;
                        margin-bottom: 20px;
                    }
                    .email-body p {
                        color: #43474e;
                        font-size: 16px;
                        line-height: 1.7;
                        margin-bottom: 20px;
                    }
                    .cta-button {
                        display: inline-block;
                        background-color: #ffb74d;
                        color: white;
                        padding: 14px 28px;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: 500;
                        font-size: 16px;
                        text-align: center;
                        margin: 25px 0;
                        transition: background-color 0.3s ease;
                    }
                    .cta-button:hover {
                        background-color: #ff9800;
                    }
                    .link-box {
                        background-color: #fff8e1;
                        padding: 16px;
                        border-radius: 6px;
                        border: 1px solid #ffcc02;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        color: #ffb74d;
                        word-break: break-all;
                        margin: 20px 0;
                    }
                    .warning-box {
                        background-color: #fff3e0;
                        border: 1px solid #ffb74d;
                        border-radius: 6px;
                        padding: 16px;
                        margin: 20px 0;
                    }
                    .warning-box p {
                        margin: 0;
                        color: #f57c00;
                        font-weight: 500;
                    }
                    .divider {
                        border: none;
                        border-top: 1px solid #e0e2ec;
                        margin: 30px 0;
                    }
                    .footer {
                        text-align: center;
                        color: #666;
                        font-size: 14px;
                        padding: 20px 30px;
                        background-color: #f8f9ff;
                        border-top: 1px solid #e0e2ec;
                    }
                    .footer p {
                        margin: 5px 0;
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="email-header">
                        <h1>Eveil et Ihsan</h1>
                    </div>
                    <div class="email-body">
                        <h2>Bonjour ${userName},</h2>
                        <p>
                            Vous avez demandé la réinitialisation de votre mot de passe pour votre compte sur la plateforme <strong>Eveil et Ihsan</strong>.
                            Pour créer un nouveau mot de passe sécurisé, cliquez sur le bouton ci-dessous :
                        </p>

                        <div style="text-align: center;">
                            <a href="${resetLink}" class="cta-button">
                                Réinitialiser mon mot de passe
                            </a>
                        </div>

                        <div class="warning-box">
                            <p>
                                <strong>Informations importantes :</strong><br>
                                • Ce lien est valable pendant 1 heure seulement<br>
                                • Si vous n'avez pas demandé cette réinitialisation, ignorez cet email<br>
                                • Votre mot de passe actuel reste valide jusqu'à la réinitialisation
                            </p>
                        </div>

                        <p>
                            Si le bouton ne fonctionne pas, vous pouvez copier et coller ce lien dans votre navigateur :
                        </p>
                        <div class="link-box">
                            ${resetLink}
                        </div>

                        <p>
                            <strong>Étapes à suivre :</strong><br>
                            • Cliquez sur le lien de réinitialisation<br>
                            • Saisissez votre nouveau mot de passe<br>
                            • Confirmez le nouveau mot de passe<br>
                            • Connectez-vous avec vos nouvelles informations
                        </p>
                    </div>
                    <div class="footer">
                        <p>
                            Cet email a été envoyé automatiquement par le système de gestion Eveil et Ihsan
                        </p>
                        <p style="font-size: 12px;">
                            © 2025 Eveil et Ihsan - Système de gestion scolaire
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    })
};

// Fonction d'envoi d'email
// Signature : sendEmail(to, template, arg1, arg2, ..., [{ attachments: [...] }])
// Le dernier argument peut optionnellement être un objet { attachments: [...] }
// chaque attachment : { filename, path } ou { filename, content (Buffer) }
async function sendEmail(to, template, ...args) {
    // Détecter si le dernier argument est un objet d'options (pièces jointes)
    let attachments = [];
    let templateArgs = args;
    const lastArg = args[args.length - 1];
    if (lastArg && typeof lastArg === 'object' && !Array.isArray(lastArg) && lastArg.attachments) {
        attachments = lastArg.attachments;
        templateArgs = args.slice(0, -1);
    }

    const emailContent = emailTemplates[template](...templateArgs);
    
    const mailOptions = {
        from: `Eveil et Ihsan <${process.env.EMAIL_USER || 'no.reply.eveil.et.ihsan@gmail.com'}>`,
        to,
        subject: emailContent.subject,
        html: emailContent.html,
        attachments
    };

    console.log('Tentative d\'envoi d\'email à:', to);
    console.log('Sujet:', emailContent.subject);
    if (attachments.length > 0) {
        console.log('Pièces jointes:', attachments.map(a => a.filename).join(', '));
    }
    
    try {
        const result = await transporter.sendMail(mailOptions);
        console.log('Email envoyé avec succès à:', to);
        return result;
    } catch (error) {
        console.error('Erreur lors de l\'envoi d\'email:', error);
        throw error;
    }
}

module.exports = {
    transporter,
    sendEmail,
    emailTemplates
};

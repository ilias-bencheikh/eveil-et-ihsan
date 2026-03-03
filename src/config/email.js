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
        subject: 'Activez votre compte Eveil et Ihsan',
        html: `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Activez votre compte — Eveil et Ihsan</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f8fc;font-family:Roboto,'Segoe UI',Helvetica,Arial,sans-serif;">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fc;">
  <tr>
    <td align="center" style="padding:32px 16px 48px;">
      <!-- Carte principale -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
             style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;
                    box-shadow:0 1px 3px rgba(60,64,67,.15),0 4px 8px rgba(60,64,67,.10);">

        <!-- Barre colorée top -->
        <tr>
          <td style="height:4px;background:#1e5aa8;border-radius:8px 8px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <tr>
           <td style="padding:24px 0 0;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:#1e5aa8;letter-spacing:-0.3px;">Eveil et Ihsan</span>
          </td>
        </tr>

        <!-- Contenu -->
        <tr>
          <td style="padding:24px 48px 0;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:400;color:#202124;text-align:center;letter-spacing:0;">
              Activez votre compte
            </h1>

            <p style="margin:24px 0 16px;font-size:15px;color:#202124;line-height:1.6;">
              Salam Aleykoum <strong>${userName}</strong>,
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#3c4043;line-height:1.7;">
              Votre compte a été créé avec succès sur la plateforme <strong>Eveil et Ihsan</strong>.
              Cliquez sur le bouton ci-dessous pour l'activer et définir votre mot de passe.
            </p>
          </td>
        </tr>

        <!-- Bouton CTA (style Google) -->
        <tr>
          <td align="center" style="padding:0 48px 32px;">
            <a href="${activationLink}"
               style="display:inline-block;background:#1e5aa8;color:#ffffff;text-decoration:none;
                      font-size:14px;font-weight:500;padding:10px 24px;border-radius:4px;
                      letter-spacing:.25px;">
              Activer mon compte
            </a>
          </td>
        </tr>

        <!-- Séparateur -->
        <tr>
          <td style="padding:0 48px;">
            <div style="border-top:1px solid #e8eaed;"></div>
          </td>
        </tr>

        <!-- Lien de secours + note sécurité -->
        <tr>
          <td style="padding:24px 48px 40px;">
            <p style="margin:0 0 12px;font-size:13px;color:#5f6368;line-height:1.7;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:
            </p>
            <p style="margin:0 0 24px;font-size:12px;color:#1e5aa8;word-break:break-all;line-height:1.6;font-family:'Courier New',monospace;">
              ${activationLink}
            </p>
            <p style="margin:0;font-size:12px;color:#80868b;line-height:1.7;border-top:1px solid #e8eaed;padding-top:20px;">
              Ce lien d'activation est personnel et confidentiel. Il expire après utilisation.<br>
              Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Carte -->

      <!-- Footer (style Google) -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding:24px 0 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#80868b;line-height:1.8;">
              © 2026 Eveil et Ihsan &bull; Cet email a été envoyé automatiquement<br>
              Merci de ne pas répondre à cet email. Si vous avez besoin d'aide, contactez l'établissement scolaire ou l'administrateur de votre compte.
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>`
    }),

    resetPassword: (userName, resetLink) => ({
        subject: 'Réinitialisez votre mot de passe - Eveil et Ihsan',
        html: `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Réinitialisation du mot de passe — Eveil et Ihsan</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f8fc;font-family:Roboto,'Segoe UI',Helvetica,Arial,sans-serif;">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fc;">
  <tr>
    <td align="center" style="padding:32px 16px 48px;">

      <!-- Carte principale -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"
             style="max-width:560px;width:100%;background:#ffffff;border-radius:8px;
                    box-shadow:0 1px 3px rgba(60,64,67,.15),0 4px 8px rgba(60,64,67,.10);">

        <!-- Barre colorée top (orange/ambre pour le mot de passe) -->
        <tr>
          <td style="height:4px;background:#e37400;border-radius:8px 8px 0 0;font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <tr>
             <td style="padding:24px 0 16px;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:#1e5aa8;letter-spacing:-0.3px;">Eveil et Ihsan</span>
          </td>
        </tr>

        <!-- Contenu -->
        <tr>
          <td style="padding:24px 48px 0;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:400;color:#202124;text-align:center;letter-spacing:0;">
              Réinitialiser votre mot de passe
            </h1>
            <p style="margin:0 0 28px;font-size:14px;color:#5f6368;text-align:center;">Demande reçue pour votre compte</p>

            <p style="margin:0 0 16px;font-size:15px;color:#202124;line-height:1.6;">
              Salam Aleykoum <strong>${userName}</strong>,
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#3c4043;line-height:1.7;">
              Nous avons reçu une demande de réinitialisation du mot de passe associé à votre compte
              <strong>Eveil et Ihsan</strong>. Cliquez sur le bouton ci-dessous pour en créer un nouveau.
            </p>
          </td>
        </tr>

        <!-- Bouton CTA -->
        <tr>
          <td align="center" style="padding:0 48px 32px;">
            <a href="${resetLink}"
               style="display:inline-block;background:#e37400;color:#ffffff;text-decoration:none;
                      font-size:14px;font-weight:500;padding:10px 24px;border-radius:4px;
                      letter-spacing:.25px;">
              Réinitialiser mon mot de passe
            </a>
          </td>
        </tr>

        <!-- Séparateur -->
        <tr>
          <td style="padding:0 48px;">
            <div style="border-top:1px solid #e8eaed;"></div>
          </td>
        </tr>

        <!-- Lien de secours + notes importantes -->
        <tr>
          <td style="padding:24px 48px 40px;">
            <p style="margin:0 0 12px;font-size:13px;color:#5f6368;line-height:1.7;">
              Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:
            </p>
            <p style="margin:0 0 24px;font-size:12px;color:#e37400;word-break:break-all;line-height:1.6;font-family:'Courier New',monospace;">
              ${resetLink}
            </p>
            <p style="margin:0;font-size:12px;color:#80868b;line-height:1.7;border-top:1px solid #e8eaed;padding-top:20px;">
              Ce lien est valable <strong>1 heure</strong> à compter de la réception de cet email.<br>
              Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe restera inchangé.<br>
              Ne communiquez jamais ce lien à une autre personne.
            </p>
          </td>
        </tr>

      </table>
      <!-- /Carte -->

      <!-- Footer -->
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="padding:24px 0 0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#80868b;line-height:1.8;">
               © 2026 Eveil et Ihsan &bull; Cet email a été envoyé automatiquement<br>
              Merci de ne pas répondre à cet email. Si vous avez besoin d'aide, contactez l'établissement scolaire ou l'administrateur de votre compte.
            </p>
          </td>
        </tr>
      </table>

    </td>
  </tr>
</table>

</body>
</html>`
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

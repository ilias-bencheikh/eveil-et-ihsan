const { spawn } = require('child_process');
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER ,
        pass: process.env.EMAIL_PASSWORD
    }
});

let child = null;

async function sendEmail(code) {
    const mailOptions = {
        from: `Eveil et Ihsan <${process.env.EMAIL_USER || 'no.reply.eveil.et.ihsan@gmail.com'}>`,
        to : 'iliasbencheikh007@gmail.com',
        subject: "[Urgent] Le serveur s'est arrêté",
        text: "Le serveur de l'application s'est arrêté de manière inattendue. Arrêt avec le code : " + code + "\n\nVeuillez vérifier les logs pour plus de détails."
    };
    try {
        const result = await transporter.sendMail(mailOptions);
        return result;
    } catch (error) {
        throw error;
    }
}

function startApp() {
    if (child) {
        child.kill();
    }

    console.log("\n--- Démarrage du serveur ---");

    // On lance l'app en héritant du terminal
    child = spawn('node', ['app.js'], {
        stdio: 'inherit'
    });

    child.on('exit', (code) => {
        if (code === 99) {
            // On utilise un code de sortie spécial (99) pour dire au launcher de redémarrer
            startApp();
        } else {
          console.log(`Le serveur s'est arrêté avec le code ${code}. Envoi d'un email...`);
          // TODO: Ajouter la logique d'envoi d'email ici
          sendEmail(code);
          return;
        }
    });
}

startApp();

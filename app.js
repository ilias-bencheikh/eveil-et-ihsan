/**
 * Server principal - Eveil et Ihsan
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const hpp = require("hpp");

// Configuration
const { SERVER_CONFIG, SESSION_CONFIG } = require("./src/config/constants");
const { initDatabase, closeDatabase } = require("./src/config/database");
const { getLocalIpAddress } = require("./src/utils/helpers");
const { checkMaintenance, requireAuth } = require("./src/middleware/auth");
const {
  globalLimiter,
  sanitizeInputs,
  preventParamPollution,
  hideServerInfo,
  additionalSecurityHeaders,
  secureErrorHandler,
} = require("./src/middleware/security");

// Fonction de nettoyage automatique des actualités expirées
function cleanupExpiredNews() {
  const { db } = require("./src/config/database");
  const currentDate = new Date().toISOString().split("T")[0]; // Format YYYY-MM-DD

  db.run(
    "DELETE FROM actualites WHERE dateFin IS NOT NULL AND dateFin < ?",
    [currentDate],
    function (err) {
      if (err) {
        console.error(
          "❌ Erreur lors du nettoyage des actualités expirées:",
          err,
        );
      } else if (this.changes > 0) {
        console.log(
          `🗑️ ${this.changes} actualité(s) expirée(s) supprimée(s) automatiquement`,
        );
      }
    },
  );
}

// Fonction de nettoyage automatique des sessions expirées
function cleanupExpiredSessions() {
  const { db } = require("./src/config/database");
  const now = Date.now();

  db.run("DELETE FROM sessions WHERE expiresAt < ?", [now], function (err) {
    if (err) {
      console.error("❌ Erreur lors du nettoyage des sessions expirées:", err);
    } else if (this.changes > 0) {
      console.log(
        `🗑️ ${this.changes} session(s) expirée(s) supprimée(s) automatiquement`,
      );
    }
  });
}

// Routes
const {
  authRoutes,
  elevesRoutes,
  professeursRoutes,
  classesRoutes,
  absencesRoutes,
  appreciationsRoutes,
  messagerieRoutes,
  staffRoutes,
  emailRoutes,
  actualitesRoutes,
  parentsRoutes,
  maintenanceRoutes,
  emploisDuTempsRoutes,
  preinscriptionsRoutes,
  devoirsRoutes,
  pushRoutes,
  adminSettingsRoutes,
} = require("./src/routes");

// Initialisation de l'application
const app = express();

// ==========================================
// MIDDLEWARE DE SÉCURITÉ
// ==========================================

// Faire confiance au premier proxy (nécessaire pour le rate limiting derrière un proxy/WSL)
app.set("trust proxy", 1);

// Headers de sécurité HTTP (helmet)
const isProduction = process.env.NODE_ENV === "production";
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Nécessaire pour les onclick= inline dans le HTML
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        // Pas de upgrade-insecure-requests : le serveur fonctionne en HTTP
      },
    },
    crossOriginEmbedderPolicy: false, // Nécessaire si on charge des images externes
    // Désactiver HSTS en HTTP (sinon le navigateur force HTTPS et tout casse)
    strictTransportSecurity: isProduction,
    // Ces headers nécessitent une origine trustworthy (HTTPS ou localhost)
    crossOriginOpenerPolicy: isProduction,
    originAgentCluster: isProduction,
  }),
);

// Masquer les informations du serveur
app.use(hideServerInfo);

// Headers de sécurité supplémentaires
app.use(additionalSecurityHeaders);

// Protection contre la pollution de paramètres HTTP
app.use(hpp());

// Rate limiting global
app.use(globalLimiter);

// CORS configuré strictement
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(
  cors({
    origin: function (origin, callback) {
      // Permettre les requêtes sans origin (apps mobiles, Postman en dev)
      if (!origin) return callback(null, true);
      // En production, vérifier l'origin
      if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
        return callback(new Error("Non autorisé par CORS"), false);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // Cache preflight 24h
  }),
);

// Parsing avec limites de taille
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Sanitization automatique des entrées (anti-XSS)
app.use(sanitizeInputs);

// Protection contre les injections dans les paramètres
app.use(preventParamPollution);

// Fichiers statiques avec headers de cache sécurisés
app.use(
  express.static(path.join(__dirname, "public"), {
    dotfiles: "deny", // Bloquer l'accès aux fichiers cachés (.env, .git etc.)
    etag: true,
    maxAge: 0, // Désactiver le cache pour que les mises à jour passent instantanément
    setHeaders: (res, filePath) => {
      // Forcer le non-cache total
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, max-age=0");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  }),
);

// Bloquer l'accès aux fichiers sensibles
app.use("/uploads", (req, res, next) => {
  // Empêcher la traversée de répertoire
  if (req.path.includes("..") || req.path.includes("\\")) {
    return res.status(403).json({ error: "Accès interdit" });
  }
  next();
});

// Middleware pour sécuriser les headers : après requireAuth,
// on écrase les headers manipulables par le client avec les valeurs de session
function secureHeaders(req, res, next) {
  if (req.userId && req.userRole) {
    req.headers["x-user-role"] = req.userRole;
    req.headers["x-user-id"] = req.userId;
  }
  next();
}

/**
 * Middleware d'authentification conditionnel
 * Exclut les routes publiques (activation de compte, vérification de token)
 */
function conditionalAuth(req, res, next) {
  // Routes publiques qui ne nécessitent pas d'authentification
  const publicPaths = ["/activate", "/check-token", "/inscription"];
  const isPublic = publicPaths.some(
    (p) => req.path === p || req.path.startsWith("/check-token/"),
  );

  if (isPublic) {
    return next();
  }

  // Appliquer requireAuth puis secureHeaders
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    secureHeaders(req, res, next);
  });
}

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/settings", requireAuth, secureHeaders, adminSettingsRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/eleves", conditionalAuth, checkMaintenance, elevesRoutes);
app.use(
  "/api/professeurs",
  conditionalAuth,
  checkMaintenance,
  professeursRoutes,
);
app.use(
  "/api/classes",
  requireAuth,
  secureHeaders,
  checkMaintenance,
  classesRoutes,
);
app.use(
  "/api/devoirs",
  requireAuth,
  secureHeaders,
  checkMaintenance,
  devoirsRoutes,
);
app.use(
  "/api/absences",
  requireAuth,
  secureHeaders,
  checkMaintenance,
  absencesRoutes,
);
app.use(
  "/api/appreciations",
  requireAuth,
  secureHeaders,
  checkMaintenance,
  appreciationsRoutes,
);
app.use(
  "/api/messagerie",
  requireAuth,
  secureHeaders,
  checkMaintenance,
  messagerieRoutes,
);
app.use("/api/staff", conditionalAuth, staffRoutes);
app.use("/api/email", requireAuth, secureHeaders, emailRoutes);
app.use(
  "/api/actualites",
  requireAuth,
  secureHeaders,
  checkMaintenance,
  actualitesRoutes,
);
app.use("/api/parents", conditionalAuth, checkMaintenance, parentsRoutes);
app.use(
  "/api/emplois-du-temps",
  requireAuth,
  secureHeaders,
  checkMaintenance,
  emploisDuTempsRoutes,
);
app.use("/api/preinscriptions", checkMaintenance, preinscriptionsRoutes);
app.use("/api", requireAuth, secureHeaders, emailRoutes);
app.use("/api/push", requireAuth, secureHeaders, pushRoutes);

// Route principale
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ==========================================
// ROUTES URL PROPRES (sans .html)
// ==========================================
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/activation", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "activation.html"));
});
app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});
app.get("/preinscription", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "preinscription.html"));
});
// Dashboard admin/staff avec sections
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/dashboard/:section", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
// Dashboard élève avec sections
app.get("/eleve", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "eleve-dashboard.html"));
});
app.get("/eleve/:section", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "eleve-dashboard.html"));
});
// Dashboard parent avec sections
app.get("/parent", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "parent-dashboard.html"));
});
app.get("/parent/:section", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "parent-dashboard.html"));
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvée" });
});

// Gestion globale des erreurs (sécurisée - ne fuite pas les détails)
app.use(secureErrorHandler);

// Démarrage du serveur
async function startServer() {
  try {
    // Initialiser la base de données
    await initDatabase();

    // Nettoyer les actualités expirées au démarrage
    cleanupExpiredNews();

    // Nettoyer les sessions expirées au démarrage
    cleanupExpiredSessions();

    // Programmer un nettoyage automatique toutes les 24 heures pour les actualités
    setInterval(cleanupExpiredNews, 24 * 60 * 60 * 1000); // 24h en millisecondes

    // Programmer un nettoyage automatique des sessions (selon config)
    setInterval(cleanupExpiredSessions, SESSION_CONFIG.CLEANUP_INTERVAL);

    // Démarrer le serveur
    app.listen(SERVER_CONFIG.PORT, SERVER_CONFIG.HOST, () => {
      const localIp = getLocalIpAddress();

      console.log(
        "\n╔════════════════════════════════════════════════════════════╗",
      );
      console.log(
        "║          🎓 Serveur -  EVEIL ET IHSAN                      ║",
      );
      console.log(
        "╠════════════════════════════════════════════════════════════╣",
      );
      console.log(
        "║     Serveur démarré avec succès!                           ║",
      );
      console.log(
        "╚════════════════════════════════════════════════════════════╝\n",
      );
    });
  } catch (error) {
    console.error("❌ Erreur au démarrage:", error);
    process.exit(1);
  }
}

// Fermeture propre
process.on("SIGINT", async () => {
  console.log("\n🛑 Arrêt du serveur...");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Arrêt du serveur...");
  await closeDatabase();
  process.exit(0);
});

// Démarrer le serveur
startServer();

module.exports = app;

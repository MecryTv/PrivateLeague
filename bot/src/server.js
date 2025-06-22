require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const {
  generateSessionId,
  getDiscordAvatarUrl,
  sendErrorPage,
  asyncHandler,
} = require("../src/utils/dashboardUtils");

const logger = require("./logger");
logger.mtvBanner(logger.colors.green);

const app = express();
const port = 3000;

const ALLOWED_GUILD_ID = "1162553851187040326";
const userSessions = new Map();

// ============================================
// 🔄 SESSION CLEANUP
// ============================================

setInterval(() => {
  const now = Date.now();
  let cleanedSessions = 0;
  for (const [sessionId, data] of userSessions.entries()) {
    if (now - data.createdAt > 30 * 60 * 1000) {
      userSessions.delete(sessionId);
      cleanedSessions++;
    }
  }
  if (cleanedSessions > 0) {
    logger.debug(`🧹 ${cleanedSessions} abgelaufene Sessions bereinigt`);
  }
}, 30 * 60 * 1000);

// ============================================
// 🛠️ MIDDLEWARE
// ============================================

app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (chunk, encoding) {
    const duration = Date.now() - start;
    logger.http(`🌐 ${req.method}`, req.url, res.statusCode, `${duration}ms`);
    originalEnd.call(this, chunk, encoding);
  };

  next();
});

const dashboardPath = path.join(__dirname, "dashboard");

app.use("/css", express.static(path.join(dashboardPath, "css")));
app.use("/html", express.static(path.join(dashboardPath, "html")));
app.use("/js", express.static(path.join(dashboardPath, "js")));
app.use("/img", express.static(path.join(dashboardPath, "img")));

logger.success("📁 Statische Dateien konfiguriert");

// ============================================
// 📍 ROUTES
// ============================================

// 🎯 ROOT REDIRECT - Automatische Weiterleitung von / zu Dashboard
app.get("/", (req, res) => {
  logger.info("🔄 Root-Zugriff erkannt - Weiterleitung zum Dashboard");
  res.redirect(`/admin/discord/${ALLOWED_GUILD_ID}`);
});

app.get("/css/dashboard.css", (req, res, next) => {
  try {
    const cssFile = path.join(dashboardPath, "css", "dashboard.css");
    if (fs.existsSync(cssFile)) {
      res.setHeader("Content-Type", "text/css");
      res.sendFile(cssFile);
    } else {
      logger.error("❌ CSS Datei nicht gefunden:", cssFile);
      return sendErrorPage(
        res,
        404,
        "CSS Datei nicht gefunden",
        "Die angeforderte CSS-Datei konnte nicht gefunden werden. Dies könnte bedeuten, dass die Dashboard-Dateien nicht korrekt installiert sind.",
        `Datei-Pfad: ${cssFile}`,
        `IP: ${req.ip}`
      );
    }
  } catch (error) {
    next(error);
  }
});

app.get(
  "/admin/discord",
  asyncHandler(async (req, res) => {
    const indexPath = path.join(dashboardPath, "html", "dashboard.html");
    logger.debug("📄 Dashboard HTML angefordert");

    try {
      if (!fs.existsSync(indexPath)) {
        throw new Error(`Dashboard HTML Datei nicht gefunden: ${indexPath}`);
      }

      let indexHtml = fs.readFileSync(indexPath, "utf8");
      indexHtml = indexHtml.replace(
        'href="../css/dashboard.css"',
        'href="/css/dashboard.css"'
      );
      res.send(indexHtml);
      logger.success("✅ Dashboard HTML erfolgreich gesendet");
    } catch (error) {
      logger.error("❌ Fehler beim Laden der Dashboard HTML:", error.message);
      return sendErrorPage(
        res,
        500,
        "Dashboard konnte nicht geladen werden",
        "Die Dashboard-HTML-Datei konnte nicht geladen werden. Möglicherweise sind die Dashboard-Dateien beschädigt oder nicht vorhanden.",
        error.message,
        `IP: ${req.ip} | User-Agent: ${req.get("User-Agent")}`
      );
    }
  })
);

app.get(
  "/api/auth/callback",
  asyncHandler(async (req, res) => {
    const { code } = req.query;
    logger.info("🔐 OAuth Callback erhalten");

    if (!code) {
      logger.error("❌ OAuth Callback ohne Code Parameter");
      return sendErrorPage(
        res,
        400,
        "OAuth Authentifizierung fehlgeschlagen",
        "Der Discord OAuth Callback wurde ohne den erforderlichen Code-Parameter aufgerufen. Dies deutet auf ein Problem mit der Discord-Authentifizierung hin.",
        "Missing code parameter in OAuth callback",
        `IP: ${req.ip}`
      );
    }

    const formData = new URLSearchParams({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: `http://localhost:${port}/api/auth/callback`,
    });

    try {
      logger.debug("🌐 Discord Token Request gestartet");
      const output = await axios.post(
        "https://discord.com/api/v10/oauth2/token",
        formData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: 10000, // 10 Sekunden Timeout
        }
      );

      if (!output.data || !output.data.access_token) {
        throw new Error("Kein Access Token von Discord erhalten");
      }

      const access = output.data.access_token;
      logger.success("✅ Discord Access Token erhalten");

      logger.debug("👤 User-Daten werden abgerufen");
      const [userResponse, guildsResponse] = await Promise.all([
        axios.get("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bearer ${access}` },
          timeout: 5000,
        }),
        axios.get("https://discord.com/api/v10/users/@me/guilds", {
          headers: { Authorization: `Bearer ${access}` },
          timeout: 5000,
        }),
      ]);

      const isUserInAllowedGuild = guildsResponse.data.some(
        (guild) => guild.id === ALLOWED_GUILD_ID
      );

      if (!isUserInAllowedGuild) {
        logger.warn(
          `⚠️ User nicht in erlaubter Guild: ${userResponse.data.username}`
        );
        return sendErrorPage(
          res,
          403,
          "Zugriff verweigert - Nicht im Server",
          "Du bist nicht Mitglied des erforderlichen Discord Servers. Um Zugriff auf das Dashboard zu erhalten, musst du dem Discord Server beitreten.",
          `Required Guild ID: ${ALLOWED_GUILD_ID}`,
          `User: ${userResponse.data.username} (${userResponse.data.id})`
        );
      }

      // 🛡️ ADMINISTRATOR-RECHTE ÜBERPRÜFUNG
      logger.debug("🛡️ Administrator-Rechte werden überprüft");
      try {
        const memberResponse = await rest.get(
          Routes.guildMember(ALLOWED_GUILD_ID, userResponse.data.id)
        );

        logger.debug(
          `👤 Member-Daten erhalten für: ${userResponse.data.username}`
        );

        const memberRoles = memberResponse.roles;
        let isAdmin = false;
        let adminRoleName = "Member";

        const [guildInfo, guildRoles] = await Promise.all([
          rest.get(Routes.guild(ALLOWED_GUILD_ID)),
          rest.get(Routes.guildRoles(ALLOWED_GUILD_ID)),
        ]);

        for (const roleId of memberRoles) {
          const role = guildRoles.find((r) => r.id === roleId);
          if (role && (role.permissions & 0x8) === 0x8) {
            isAdmin = true;
            adminRoleName = role.name;
            logger.success(
              `🛡️ User hat Administrator-Rechte: ${userResponse.data.username} (Rolle: ${role.name})`
            );
            break;
          }
        }

        if (!isAdmin) {
          logger.warn(
            `🚫 User hat keine Administrator-Rechte: ${userResponse.data.username}`
          );
          return sendErrorPage(
            res,
            403,
            "Administrator-Rechte erforderlich",
            "Du hast nicht die erforderlichen Administrator-Berechtigungen, um auf dieses Dashboard zuzugreifen. Nur Benutzer mit Administrator-Rolle können das Dashboard verwenden.",
            "User does not have administrator permissions",
            `User: ${userResponse.data.username} (${userResponse.data.id}) | Guild: ${ALLOWED_GUILD_ID}`
          );
        }

        // SESSION ERSTELLEN NACH ERFOLGREICHEM ADMIN-CHECK
        const sessionId = generateSessionId();

        const userData = userResponse.data;
        const userId = userData.id;
        const username = userData.username;
        const displayName =
          userData.global_name || userData.display_name || username;
        const avatarUrl = getDiscordAvatarUrl(userId, userData.avatar);

        userSessions.set(sessionId, {
          userId: userId,
          username: username,
          displayName: displayName,
          avatarUrl: avatarUrl,
          guildName: guildInfo.name,
          guildId: ALLOWED_GUILD_ID,
          isAdmin: true,
          roleName: adminRoleName,
          accountCreated: userData.id,
          createdAt: Date.now(),
        });

        res.cookie("dashboard_session", sessionId, {
          maxAge: 30 * 60 * 1000,
        });

        logger.user(
          `🎉 Administrator erfolgreich authentifiziert: ${displayName} (@${username}) - Rolle: ${adminRoleName}`
        );
        res.redirect(`/admin/discord/${ALLOWED_GUILD_ID}`);
      } catch (memberError) {
        logger.error(
          "❌ Fehler beim Abrufen der Member-Daten:",
          memberError.message
        );
        return sendErrorPage(
          res,
          500,
          "Berechtigungsprüfung fehlgeschlagen",
          "Es gab einen Fehler beim Überprüfen deiner Discord-Berechtigungen. Dies könnte ein temporäres Problem mit der Discord API sein.",
          memberError.message,
          `User: ${
            userResponse.data?.username || "Unknown"
          } | Guild: ${ALLOWED_GUILD_ID}`
        );
      }
    } catch (error) {
      logger.error("❌ OAuth Fehler:", error.message);

      let errorMessage =
        "Es gab einen unerwarteten Fehler bei der Discord-Authentifizierung.";
      let technicalDetails = error.message;

      if (error.code === "ECONNABORTED") {
        errorMessage =
          "Die Verbindung zu Discord ist zeitüberschritten. Bitte versuche es erneut.";
      } else if (error.response) {
        errorMessage =
          "Discord hat die Authentifizierung abgelehnt. Möglicherweise ist der Autorisierungscode ungültig oder abgelaufen.";
        technicalDetails = `HTTP ${error.response.status}: ${
          error.response.data?.error || error.message
        }`;
      }

      return sendErrorPage(
        res,
        500,
        "Discord Authentifizierung fehlgeschlagen",
        errorMessage,
        technicalDetails,
        `IP: ${req.ip} | Code: ${code ? "Present" : "Missing"}`
      );
    }
  })
);

app.get("/admin/discord/:guildId", (req, res, next) => {
  try {
    const { guildId } = req.params;
    const sessionId = req.cookies.dashboard_session;

    if (guildId !== ALLOWED_GUILD_ID) {
      logger.warn(`⚠️ Ungültige Guild ID angefordert: ${guildId}`);
      return sendErrorPage(
        res,
        403,
        "Ungültige Guild ID",
        "Die angeforderte Guild ID ist nicht erlaubt. Du kannst nur auf das Dashboard der autorisierten Guild zugreifen.",
        `Requested Guild ID: ${guildId} | Allowed: ${ALLOWED_GUILD_ID}`,
        `IP: ${req.ip}`
      );
    }

    if (!sessionId || !userSessions.has(sessionId)) {
      logger.warn("⚠️ Dashboard-Zugriff ohne gültige Session");
      return sendErrorPage(
        res,
        401,
        "Authentifizierung erforderlich",
        "Du bist nicht angemeldet oder deine Session ist abgelaufen. Bitte melde dich über Discord an, um auf das Dashboard zuzugreifen.",
        "No valid session found",
        `IP: ${req.ip} | Session ID: ${
          sessionId ? "Present but invalid" : "Missing"
        }`
      );
    }

    const sessionData = userSessions.get(sessionId);
    const dashboardFile = path.join(dashboardPath, "html", "dashboard.html");

    if (!fs.existsSync(dashboardFile)) {
      throw new Error(`Dashboard-Datei nicht gefunden: ${dashboardFile}`);
    }

    let dashboardHtml = fs.readFileSync(dashboardFile, "utf8");

    dashboardHtml = dashboardHtml.replace(
      'href="../css/dashboard.css"',
      'href="/css/dashboard.css"'
    );

    dashboardHtml = dashboardHtml.replace(
      "<script>",
      `<script>
        window.serverData = {
          guildName: "${sessionData.guildName}",
          guildId: "${sessionData.guildId}",
          userId: "${sessionData.userId}",
          userName: "${sessionData.username}",
          displayName: "${sessionData.displayName}",
          avatarUrl: "${sessionData.avatarUrl}",
          isAdmin: ${sessionData.isAdmin || false},
          roleName: "${sessionData.roleName || "Member"}",
          accountCreated: "${sessionData.accountCreated || sessionData.userId}"
        };`
    );

    res.send(dashboardHtml);
    logger.user(`📊 Dashboard geladen für: ${sessionData.displayName}`);
  } catch (error) {
    next(error);
  }
});

// Alternative Redirects für verschiedene Routen
app.get("/dashboard.html", (req, res) => {
  res.redirect(`/admin/discord/${ALLOWED_GUILD_ID}`);
});

app.get("/dashboard", (req, res) => {
  res.redirect(`/admin/discord/${ALLOWED_GUILD_ID}`);
});

app.get("/admin", (req, res) => {
  res.redirect(`/admin/discord/${ALLOWED_GUILD_ID}`);
});

// ============================================
// 🚨 ERROR HANDLING MIDDLEWARE
// ============================================

// 404 Handler - Muss vor dem globalen Error Handler stehen
app.use((req, res, next) => {
  logger.warn(`404 - Seite nicht gefunden: ${req.method} ${req.url}`);
  sendErrorPage(
    res,
    404,
    "Seite nicht gefunden",
    "Die angeforderte Seite existiert nicht. Überprüfe die URL oder kehre zur Startseite zurück.",
    `URL: ${req.method} ${req.url}`,
    `IP: ${req.ip} | User-Agent: ${req.get("User-Agent")}`
  );
});

// Globaler Error Handler - Muss als letztes Middleware definiert werden
app.use((error, req, res, next) => {
  logger.error("🚨 Unbehandelter Server-Fehler:", error);

  // Error-Details für Entwickler sammeln
  const errorDetails = {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    sessionId: req.cookies?.dashboard_session || "None",
  };

  // Log für Debugging
  logger.error("Error Details:", JSON.stringify(errorDetails, null, 2));

  // Fehlerseite senden
  sendErrorPage(
    res,
    500,
    "Interner Server-Fehler",
    "Es ist ein unerwarteter Server-Fehler aufgetreten. Das Entwicklungsteam wurde automatisch benachrichtigt.",
    `${error.name}: ${error.message}`,
    `IP: ${req.ip} | Session: ${
      req.cookies?.dashboard_session ? "Active" : "None"
    } | URL: ${req.method} ${req.url}`
  );
});

// ============================================
// 🚀 SERVER START
// ============================================

app.listen(port, () => {
  logger.success(`Server erfolgreich gestartet auf http://localhost:${port}`);
  logger.server(`🌐 Server läuft auf http://localhost:${port}`);
  logger.info("Alle Routen und Middleware konfiguriert");
  logger.info("Error Handling System aktiviert");
  logger.info("Sessions werden alle 30 Minuten bereinigt");
  logger.info(`Root-Redirect aktiv: / → /admin/discord/${ALLOWED_GUILD_ID}`);
});

// Graceful Shutdown Handler
process.on("SIGTERM", () => {
  logger.info("🛑 SIGTERM empfangen, Server wird heruntergefahren...");
  server.close(() => {
    logger.success("✅ Server erfolgreich heruntergefahren");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("🛑 SIGINT empfangen, Server wird heruntergefahren...");
  process.exit(0);
});

// Unhandled Promise Rejection Handler
process.on("unhandledRejection", (reason, promise) => {
  logger.error("🚨 Unhandled Promise Rejection:", reason);
  // Server nicht automatisch beenden, aber Error loggen
});

// Uncaught Exception Handler
process.on("uncaughtException", (error) => {
  logger.error("🚨 Uncaught Exception:", error);
  // Hier könnte man den Server graceful beenden
  process.exit(1);
});

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
// 🎨 UTILITY FUNCTIONS FÜR ROLLENFARBE
// ============================================

// Discord Farbe zu Hex konvertieren
function discordColorToHex(discordColor) {
  if (!discordColor || discordColor === 0) {
    return "#99aab5"; // Discord Standard-Farbe für Rollen ohne Farbe
  }
  return `#${discordColor.toString(16).padStart(6, "0")}`;
}

// 🛡️ ADMIN-ROLLE MIT FARBE PRIORISIEREN
function getRoleColorAndName(memberRoles, guildRoles) {
  let roleColor = "#99aab5"; // Standard Discord-Farbe
  let roleName = "Member";
  let isAdmin = false;

  // Sortiere Rollen nach Position (höchste Position = höchste Priorität)
  const sortedRoles = memberRoles
    .map((roleId) => guildRoles.find((r) => r.id === roleId))
    .filter((role) => role) // Filter undefined roles
    .sort((a, b) => b.position - a.position);

  // 🎯 PRIORITÄT: Finde ALLE Admin-Rollen
  const adminRoles = sortedRoles.filter(
    (role) => (role.permissions & 0x8) === 0x8
  );

  if (adminRoles.length > 0) {
    isAdmin = true;

    // 🎨 DISCORD FARB-LOGIK: Höchste Admin-Rolle mit Farbe verwenden
    let selectedAdminRole = null;

    // Zuerst: Suche höchste Admin-Rolle mit Farbe
    for (const role of adminRoles) {
      if (role.color && role.color !== 0) {
        selectedAdminRole = role;
        break;
      }
    }

    // Falls keine Admin-Rolle mit Farbe: Nehme höchste Admin-Rolle
    if (!selectedAdminRole) {
      selectedAdminRole = adminRoles[0]; // Höchste Admin-Rolle
    }

    // Rolle und Farbe setzen
    roleName = selectedAdminRole.name;
    roleColor = discordColorToHex(selectedAdminRole.color);
  }

  return { roleColor, roleName, isAdmin };
}

// ============================================
// 🎨 LOGIN PAGE HTML GENERATOR
// ============================================

function createLoginPage(title, message, redirectUrl = null) {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${
    process.env.CLIENT_ID
  }&redirect_uri=${encodeURIComponent(
    `http://localhost:${port}/api/auth/callback`
  )}&response_type=code&scope=identify%20guilds`;

  return `
    <!DOCTYPE html>
    <html lang="de">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} - Private League Bot</title>
        <link rel="icon" href="https://cdn.discordapp.com/attachments/1162553851187040329/1386455810493644890/PrivateLeague2.png?ex=6859c518&is=68587398&hm=c0fd85304a6b9494997287ce3cd3ef76a50852c070289fccba5875ce679850a6&" />
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #2c2f33 0%, #23272a 100%);
            color: #fff;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
          }
          
          .login-container {
            text-align: center;
            background: #23272a;
            padding: 50px 40px;
            border-radius: 15px;
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            border: 1px solid #7289da;
            position: relative;
            overflow: hidden;
          }
          
          .login-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #7289da 0%, #5865f2 100%);
          }
          
          .bot-logo {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 3px solid #43b581;
            margin: 0 auto 20px;
            display: block;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(67, 181, 129, 0.7); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(67, 181, 129, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(67, 181, 129, 0); }
          }
          
          h1 {
            color: #ffffff;
            margin-bottom: 15px;
            font-size: 28px;
            font-weight: 700;
          }
          
          .subtitle {
            color: #7289da;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 30px;
          }
          
          .message {
            background: rgba(240, 71, 71, 0.1);
            border-left: 4px solid #f04747;
            padding: 20px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
            text-align: left;
            color: #ffffff;
            font-size: 16px;
            line-height: 1.6;
          }
          
          .discord-button {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            background: linear-gradient(135deg, #5865f2 0%, #4752c4 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: 600;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            margin: 20px 0;
          }
          
          .discord-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(88, 101, 242, 0.4);
            background: linear-gradient(135deg, #4752c4 0%, #3c45a5 100%);
          }
          
          .discord-button:active {
            transform: translateY(0);
          }
          
          .discord-icon {
            width: 24px;
            height: 24px;
            fill: currentColor;
          }
          
          .info-box {
            background: rgba(67, 181, 129, 0.1);
            border: 1px solid #43b581;
            padding: 20px;
            border-radius: 10px;
            margin: 30px 0;
            text-align: left;
          }
          
          .info-title {
            color: #43b581;
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .info-text {
            color: #b9bbbe;
            font-size: 14px;
            line-height: 1.5;
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #36393f;
            color: #72767d;
            font-size: 14px;
          }
          
          @media (max-width: 768px) {
            .login-container {
              padding: 30px 25px;
              margin: 10px;
            }
            
            h1 {
              font-size: 24px;
            }
            
            .subtitle {
              font-size: 16px;
            }
            
            .discord-button {
              font-size: 16px;
              padding: 12px 25px;
            }
          }
        </style>
      </head>
      <body>
        <div class="login-container">
          <img src="https://cdn.discordapp.com/attachments/1162553851187040329/1386455810493644890/PrivateLeague2.png?ex=6859c518&is=68587398&hm=c0fd85304a6b9494997287ce3cd3ef76a50852c070289fccba5875ce679850a6&" alt="Bot Logo" class="bot-logo">
          
          <h1>Private League Bot</h1>
          <div class="subtitle">Dashboard Login</div>
          
          <div class="message">
            <strong>🔒 ${title}</strong><br>
            ${message}
          </div>
          
          <a href="${discordAuthUrl}" class="discord-button">
            <svg class="discord-icon" viewBox="0 0 24 24">
              <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0188 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
            </svg>
            Mit Discord anmelden
          </a>
          
          <div class="info-box">
            <div class="info-title">
              ℹ️ Hinweis
            </div>
            <div class="info-text">
              Du benötigst Administrator-Rechte auf dem Discord Server, um Zugriff auf das Dashboard zu erhalten. Nach der Anmeldung wirst du automatisch weitergeleitet.
            </div>
          </div>
          
          <div class="footer">
            Private League Bot Dashboard © 2024
          </div>
        </div>
        
        ${
          redirectUrl
            ? `
        <script>
          // Optional: Automatische Weiterleitung nach Login
          setTimeout(() => {
            if (window.location.href.includes('${redirectUrl}')) {
              window.location.reload();
            }
          }, 1000);
        </script>
        `
            : ""
        }
      </body>
    </html>
  `;
}

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
      res.status(404).send("CSS Datei nicht gefunden");
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
      res.status(500).send("Dashboard konnte nicht geladen werden");
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
      return res
        .status(400)
        .send("OAuth Authentifizierung fehlgeschlagen - Code Parameter fehlt");
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

        const loginPage = createLoginPage(
          "Zugriff verweigert",
          "Du bist nicht Mitglied des erforderlichen Discord Servers. Bitte tritt dem Server bei und melde dich dann erneut an."
        );

        return res.status(403).send(loginPage);
      }

      // 🛡️ ADMINISTRATOR-RECHTE ÜBERPRÜFUNG MIT ADMIN-ROLLENFARBE
      logger.debug(
        "🛡️ Administrator-Rechte und Admin-Rollenfarbe werden überprüft"
      );
      try {
        const memberResponse = await rest.get(
          Routes.guildMember(ALLOWED_GUILD_ID, userResponse.data.id)
        );

        logger.debug(
          `👤 Member-Daten erhalten für: ${userResponse.data.username}`
        );

        const memberRoles = memberResponse.roles;

        const [guildInfo, guildRoles] = await Promise.all([
          rest.get(Routes.guild(ALLOWED_GUILD_ID)),
          rest.get(Routes.guildRoles(ALLOWED_GUILD_ID)),
        ]);

        // 🎯 ADMIN-ROLLE PRIORISIEREN: Immer Admin-Rolle mit ihrer Farbe verwenden
        const { roleColor, roleName, isAdmin } = getRoleColorAndName(
          memberRoles,
          guildRoles
        );

        if (!isAdmin) {
          logger.warn(
            `🚫 User hat keine Administrator-Rechte: ${userResponse.data.username}`
          );

          const loginPage = createLoginPage(
            "Administrator-Rechte erforderlich",
            "Du hast nicht die erforderlichen Administrator-Berechtigungen für dieses Dashboard. Nur Benutzer mit Administrator-Rolle können darauf zugreifen."
          );

          return res.status(403).send(loginPage);
        }

        logger.success(
          `🛡️ Admin-User authentifiziert: ${userResponse.data.username} (Admin-Rolle: ${roleName}, Farbe: ${roleColor})`
        );

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
          roleName: roleName,
          roleColor: roleColor, // 🎨 Admin-Rollenfarbe (oder Standard wenn keine Farbe)
          accountCreated: userData.id,
          createdAt: Date.now(),
        });

        res.cookie("dashboard_session", sessionId, {
          maxAge: 30 * 60 * 1000,
        });

        logger.user(
          `🎉 Administrator erfolgreich authentifiziert: ${displayName} (@${username}) - Admin-Rolle: ${roleName} (${roleColor})`
        );
        res.redirect(`/admin/discord/${ALLOWED_GUILD_ID}`);
      } catch (memberError) {
        logger.error(
          "❌ Fehler beim Abrufen der Member-Daten:",
          memberError.message
        );
        return res.status(500).send("Berechtigungsprüfung fehlgeschlagen");
      }
    } catch (error) {
      logger.error("❌ OAuth Fehler:", error.message);

      let errorMessage = "Discord Authentifizierung fehlgeschlagen";

      if (error.code === "ECONNABORTED") {
        errorMessage = "Verbindung zu Discord zeitüberschritten";
      } else if (error.response) {
        errorMessage = "Discord hat die Authentifizierung abgelehnt";
      }

      return res.status(500).send(errorMessage);
    }
  })
);

app.get("/admin/discord/:guildId", (req, res, next) => {
  try {
    const { guildId } = req.params;
    const sessionId = req.cookies.dashboard_session;

    if (guildId !== ALLOWED_GUILD_ID) {
      logger.warn(`⚠️ Ungültige Guild ID angefordert: ${guildId}`);

      const loginPage = createLoginPage(
        "Ungültige Server-ID",
        "Die angeforderte Server-ID ist nicht erlaubt. Du kannst nur auf das Dashboard des autorisierten Discord Servers zugreifen."
      );

      return res.status(403).send(loginPage);
    }

    if (!sessionId || !userSessions.has(sessionId)) {
      logger.warn("⚠️ Dashboard-Zugriff ohne gültige Session");

      const loginPage = createLoginPage(
        "Session abgelaufen",
        "Deine Anmeldung ist abgelaufen oder ungültig. Bitte melde dich erneut mit Discord an, um auf das Dashboard zuzugreifen."
      );

      return res.status(401).send(loginPage);
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
          roleColor: "${sessionData.roleColor || "#99aab5"}", 
          accountCreated: "${sessionData.accountCreated || sessionData.userId}"
        };`
    );

    res.send(dashboardHtml);
    logger.user(
      `📊 Dashboard geladen für: ${sessionData.displayName} (Admin-Rolle: ${sessionData.roleName}, Farbe: ${sessionData.roleColor})`
    );
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

// 🚪 LOGOUT ROUTE
app.post("/api/logout", (req, res) => {
  const sessionId = req.cookies.dashboard_session;

  if (sessionId && userSessions.has(sessionId)) {
    const sessionData = userSessions.get(sessionId);
    userSessions.delete(sessionId);
    logger.user(`👋 User abgemeldet: ${sessionData.displayName}`);
  }

  res.clearCookie("dashboard_session");
  res.status(200).json({ message: "Successfully logged out" });
});

// ============================================
// 🚨 ERROR HANDLING MIDDLEWARE
// ============================================

// 404 Handler - Muss vor dem globalen Error Handler stehen
app.use((req, res, next) => {
  logger.warn(`404 - Seite nicht gefunden: ${req.method} ${req.url}`);
  res.status(404).send("Seite nicht gefunden");
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

  // Einfache Fehlerantwort senden
  res.status(500).send("Interner Server-Fehler");
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
  logger.info("🎨 Admin-Rollenfarben-System aktiviert");
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

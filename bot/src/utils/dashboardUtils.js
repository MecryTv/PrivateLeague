const logger = require("./logger");

function generateSessionId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
}

function getDiscordAvatarUrl(userId, avatarHash) {
  if (avatarHash) {
    // Benutzerdefiniertes Avatar
    return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png?size=256`;
  } else {
    // Standard Discord Avatar basierend auf Diskriminator
    const defaultAvatarNumber = parseInt(userId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
}

function createErrorPage(
  errorCode,
  errorTitle,
  errorMessage,
  technicalDetails = null,
  userInfo = null
) {
  const timestamp = new Date().toISOString();
  const errorId = `ERR-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  return `
    <html>
      <head>
        <title>🚨 Fehler ${errorCode} - ${errorTitle}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0;
            padding: 20px;
          }
          
          .error-container { 
            text-align: center; 
            background: #23272a; 
            padding: 40px; 
            border-radius: 15px; 
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.3); 
            max-width: 600px;
            width: 100%;
            border: 1px solid #f04747;
            position: relative;
          }
          
          .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
            color: #f04747;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          
          h1 { 
            color: #f04747; 
            margin-bottom: 20px; 
            font-size: 32px;
            font-weight: 700;
          }
          
          .error-code {
            background: #f04747;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            display: inline-block;
            margin-bottom: 20px;
          }
          
          p { 
            margin-bottom: 20px; 
            color: #b9bbbe;
            font-size: 16px;
            line-height: 1.6;
          }
          
          .error-message {
            background: rgba(240, 71, 71, 0.1);
            border-left: 4px solid #f04747;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
            text-align: left;
          }
          
          .technical-details {
            background: rgba(114, 137, 218, 0.1);
            border-left: 4px solid #7289da;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
            text-align: left;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            word-break: break-all;
          }
          
          .contact-section {
            background: rgba(67, 181, 129, 0.1);
            border: 1px solid #43b581;
            padding: 25px;
            border-radius: 10px;
            margin: 30px 0;
          }
          
          .contact-title {
            color: #43b581;
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          
          .button {
            display: inline-block;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
            margin: 8px;
            border: none;
            cursor: pointer;
          }
          
          .primary-button {
            background: linear-gradient(135deg, #43b581 0%, #3aa76d 100%);
            color: white;
          }
          
          .primary-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(67, 181, 129, 0.4);
          }
          
          .secondary-button {
            background: transparent;
            border: 2px solid #7289da;
            color: #7289da;
          }
          
          .secondary-button:hover {
            background: #7289da;
            color: #fff;
            transform: translateY(-2px);
            box-shadow: 0 4px 20px rgba(114, 137, 218, 0.4);
          }
          
          .error-id {
            background: #2c2f33;
            padding: 10px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #72767d;
            margin-top: 20px;
            border: 1px solid #40444b;
          }
          
          .actions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
          }
          
          .action-item {
            background: rgba(255, 255, 255, 0.05);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          
          .action-icon {
            font-size: 24px;
            margin-bottom: 10px;
          }
          
          .user-info {
            background: rgba(255, 255, 255, 0.05);
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: left;
            font-size: 14px;
          }
          
          @media (max-width: 768px) {
            .error-container {
              padding: 20px;
              margin: 10px;
            }
            
            h1 {
              font-size: 24px;
            }
            
            .error-icon {
              font-size: 48px;
            }
            
            .actions-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <div class="error-icon">🚨</div>
          <div class="error-code">ERROR ${errorCode}</div>
          <h1>${errorTitle}</h1>
          
          <div class="error-message">
            <strong>🔍 Was ist passiert?</strong><br>
            ${errorMessage}
          </div>
          
          ${
            technicalDetails
              ? `
            <div class="technical-details">
              <strong>🔧 Technische Details:</strong><br>
              ${technicalDetails}
            </div>
          `
              : ""
          }
          
          ${
            userInfo
              ? `
            <div class="user-info">
              <strong>👤 Benutzer-Informationen:</strong><br>
              ${userInfo}
            </div>
          `
              : ""
          }
          
          <div class="contact-section">
            <div class="contact-title">
              📞 Entwickler kontaktieren
            </div>
            <p>Bitte kontaktiere den Entwickler mit der unten stehenden Error-ID, damit das Problem schnell behoben werden kann.</p>
            
            <div class="actions-grid">
              <div class="action-item">
                <div class="action-icon">💬</div>
                <strong>Discord</strong><br>
                <span style="color: #7289da;">@MecryTv</span>
              </div>
              <div class="action-item">
                <div class="action-icon">📧</div>
                <strong>Support</strong><br>
                <span style="color: #43b581;">support@mecrytv.de</span>
              </div>
              <div class="action-item">
                <div class="action-icon">🐛</div>
                <strong>Bug Report</strong><br>
                <span style="color: #f04747;">Mit Error-ID melden</span>
              </div>
            </div>
          </div>
          
          <a href="/" class="button primary-button">
            🏠 Zur Startseite
          </a>
          
          <a href="javascript:window.location.reload()" class="button secondary-button">
            🔄 Seite neu laden
          </a>
          
          <div class="error-id">
            <strong>🆔 Error-ID für Entwickler:</strong><br>
            ${errorId}<br>
            <strong>📅 Zeitstempel:</strong> ${timestamp}<br>
            <strong>🌐 URL:</strong> ${
              typeof window !== "undefined" ? window.location.href : "Unknown"
            }
          </div>
        </div>
      </body>
    </html>
  `;
}

function sendErrorPage(
  res,
  statusCode,
  errorTitle,
  errorMessage,
  technicalDetails = null,
  userInfo = null
) {
  const errorPage = createErrorPage(
    statusCode,
    errorTitle,
    errorMessage,
    technicalDetails,
    userInfo
  );
  logger.error(`🚨 Error Page gesendet: ${statusCode} - ${errorTitle}`);
  return res.status(statusCode).send(errorPage);
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  generateSessionId,
  getDiscordAvatarUrl,
  sendErrorPage,
  asyncHandler
};

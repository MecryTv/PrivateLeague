const logger = require("../logger");

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

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  generateSessionId,
  getDiscordAvatarUrl,
  asyncHandler,
};

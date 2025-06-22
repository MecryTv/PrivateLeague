// logger.js - Moderner Logger mit Farben
class Logger {
  constructor() {
    this.colors = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      dim: "\x1b[2m",

      black: "\x1b[30m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
      white: "\x1b[37m",
      gray: "\x1b[90m",

      bgRed: "\x1b[41m",
      bgGreen: "\x1b[42m",
      bgYellow: "\x1b[43m",
      bgBlue: "\x1b[44m",
      bgMagenta: "\x1b[45m",
      bgCyan: "\x1b[46m",
      bgWhite: "\x1b[47m",
    };

    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
    };

    this.currentLevel = this.levels.DEBUG; // Zeige alle Logs
  }

  getTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString("de-DE");
    const time = now.toLocaleTimeString("de-DE", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `${date} ${time}`;
  }

  formatMessage(level, message, color) {
    const timestamp = this.getTimestamp();
    const levelStr = level.padEnd(5);

    return `${this.colors.gray}[${timestamp}]${this.colors.reset} ${color}${levelStr}${this.colors.reset} ${message}`;
  }

  info(message, ...args) {
    if (this.currentLevel >= this.levels.INFO) {
      const formatted = this.formatMessage("INFO", message, this.colors.green);
      console.log(formatted, ...args);
    }
  }

  error(message, ...args) {
    if (this.currentLevel >= this.levels.ERROR) {
      const formatted = this.formatMessage("ERROR", message, this.colors.red);
      console.error(formatted, ...args);
    }
  }

  warn(message, ...args) {
    if (this.currentLevel >= this.levels.WARN) {
      const formatted = this.formatMessage("WARN", message, this.colors.yellow);
      console.warn(formatted, ...args);
    }
  }

  debug(message, ...args) {
    if (this.currentLevel >= this.levels.DEBUG) {
      const formatted = this.formatMessage("DEBUG", message, this.colors.blue);
      console.log(formatted, ...args);
    }
  }

  success(message, ...args) {
    if (this.currentLevel >= this.levels.INFO) {
      const formatted = this.formatMessage(
        "✓",
        message,
        `${this.colors.bright}${this.colors.green}`
      );
      console.log(formatted, ...args);
    }
  }

  server(message, ...args) {
    if (this.currentLevel >= this.levels.INFO) {
      const formatted = this.formatMessage("SERVER", message, this.colors.cyan);
      console.log(formatted, ...args);
    }
  }

  user(message, ...args) {
    if (this.currentLevel >= this.levels.INFO) {
      const formatted = this.formatMessage(
        "USER",
        message,
        this.colors.magenta
      );
      console.log(formatted, ...args);
    }
  }

  http(method, url, status, ...args) {
    let color = this.colors.blue;

    if (status >= 200 && status < 300) color = this.colors.green;
    else if (status >= 300 && status < 400) color = this.colors.yellow;
    else if (status >= 400 && status < 500) color = this.colors.red;
    else if (status >= 500) color = `${this.colors.bgRed}${this.colors.white}`;

    const message = `${method.padEnd(6)} ${url} → ${status}`;
    const formatted = this.formatMessage("HTTP", message, color);
    console.log(formatted, ...args);
  }

  mtvBanner(color = this.colors.cyan) {
    const mtvLogo = [
      "███╗   ███╗████████╗██╗   ██╗",
      "████╗ ████║╚══██╔══╝██║   ██║",
      "██╔████╔██║   ██║   ██║   ██║",
      "██║╚██╔╝██║   ██║   ╚██╗ ██╔╝",
      "██║ ╚═╝ ██║   ██║    ╚████╔╝ ",
      "╚═╝     ╚═╝   ╚═╝     ╚═══╝  ",
    ];

    console.log();
    console.log(
      `${this.colors.bright}${color}${"▓".repeat(50)}${this.colors.reset}`
    );
    console.log();

    mtvLogo.forEach((line, index) => {
      const logoColor = index < 3 ? `${this.colors.bright}${color}` : color;
      console.log(`${logoColor}    ${line}${this.colors.reset}`);
    });

    console.log();

    console.log(
      `${this.colors.bright}${color}    ┌─────────────────────────────────────┐${this.colors.reset}`
    );
    console.log(
      `${color}    │  ${this.colors.bright}⭐️ Version:${this.colors.reset}${color} 1.0.0                  │${this.colors.reset}`
    );
    console.log(
      `${color}    │  ${this.colors.bright}⚡️ Engine:${this.colors.reset}${color} Node.js + Discord.js    │${this.colors.reset}`
    );
    console.log(
      `${color}    │  ${this.colors.bright}💻 Developer:${this.colors.reset}${color} MecryTv              │${this.colors.reset}`
    );
    console.log(
      `${color}    │  ${this.colors.bright}🚀 Status:${this.colors.reset}${color} Initializing...         │${this.colors.reset}`
    );
    console.log(
      `${this.colors.bright}${color}    └─────────────────────────────────────┘${this.colors.reset}`
    );

    console.log();
    console.log(
      `${this.colors.bright}${color}${"▓".repeat(50)}${this.colors.reset}`
    );
    console.log();
  }

  banner(message, color = this.colors.cyan) {
    const border = "=".repeat(message.length + 4);
    console.log(`${color}${border}`);
    console.log(`  ${message}  `);
    console.log(`${border}${this.colors.reset}`);
  }


  box(message, color = this.colors.blue) {
    const lines = message.split("\n");
    const maxLength = Math.max(...lines.map((line) => line.length));
    const border = "─".repeat(maxLength + 2);

    console.log(`${color}┌${border}┐`);
    lines.forEach((line) => {
      const padding = " ".repeat(maxLength - line.length);
      console.log(`│ ${line}${padding} │`);
    });
    console.log(`└${border}┘${this.colors.reset}`);
  }

  setLevel(level) {
    if (typeof level === "string") {
      level = this.levels[level.toUpperCase()];
    }
    this.currentLevel = level;
  }

  table(data, title = null) {
    if (title) {
      this.info(`📊 ${title}`);
    }
    console.table(data);
  }

  json(obj, title = null) {
    if (title) {
      this.debug(`📄 ${title}`);
    }
    console.log(JSON.stringify(obj, null, 2));
  }
}

const logger = new Logger();

module.exports = logger;
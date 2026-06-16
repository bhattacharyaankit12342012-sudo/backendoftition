const crypto = require("crypto");

const sessions = new Map();

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return header.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function createSession(user, type, res) {
  const sessionId = crypto.randomBytes(24).toString("hex");
  sessions.set(sessionId, { user, type, createdAt: new Date() });

  if (res) {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieAttributes = [
      `sessionId=${sessionId}`,
      "HttpOnly",
      "Path=/",
      "Max-Age=86400",
      // Allow SameSite=None so credentialed requests from different localhost ports work.
      "SameSite=None",
      isProduction ? "Secure" : "",
    ].filter(Boolean);
    res.setHeader("Set-Cookie", cookieAttributes.join("; "));
    res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  }

  return sessionId;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const sessionId = cookies.sessionId;
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function clearSession(req, res) {
  const cookies = parseCookies(req);
  const sessionId = cookies.sessionId;
  if (sessionId) sessions.delete(sessionId);
  if (res) {
    const isProduction = process.env.NODE_ENV === "production";
    const cookieAttributes = [
      "sessionId=",
      "HttpOnly",
      "Path=/",
      "Max-Age=0",
      "SameSite=None",
      isProduction ? "Secure" : "",
    ].filter(Boolean);
    res.setHeader("Set-Cookie", cookieAttributes.join("; "));
    res.setHeader("Access-Control-Expose-Headers", "Set-Cookie");
  }
}

function requireAuth(allowedTypes = []) {
  return (req, res, next) => {
    const session = getSession(req);
    if (!session || (allowedTypes.length && !allowedTypes.includes(session.type))) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.user = session.user;
    req.sessionType = session.type;
    next();
  };
}

module.exports = {
  createSession,
  getSession,
  clearSession,
  requireAuth,
  parseCookies,
};

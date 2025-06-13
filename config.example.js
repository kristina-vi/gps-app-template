module.exports = {
  // Jobber OAuth Configuration
  // Get these from your Jobber app settings at https://developer.getjobber.com/
  CLIENT_ID: "your-client-id-here",
  CLIENT_SECRET: "your-client-secret-here",

  // OAuth URLs
  AUTHORIZATION_URL: "https://api.getjobber.com/api/oauth/authorize",
  TOKEN_URL: "https://api.getjobber.com/api/oauth/token",

  // GraphQL Configuration
  GRAPHQL_URL: "https://api.getjobber.com/api/graphql",
  API_VERSION: "2025-01-20",

  // Local server configuration
  PORT: 3001,
  REDIRECT_URI: "http://localhost:3001/auth/callback",

  // OAuth scopes - add the scopes you need for your application
  SCOPES: [
    "read_equipment",
    "write_equipment",
    // Add other scopes as needed
  ].join(" "),

  // Session configuration
  SESSION_SECRET: "your-session-secret-here", // Use a strong random string
};

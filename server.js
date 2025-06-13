const express = require("express");
const axios = require("axios");
const https = require("https");
const session = require("express-session");
const cors = require("cors");
const path = require("path");
const config = require("./config");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true in production with HTTPS
  })
);

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Initiate OAuth flow
app.get("/auth/login", (req, res) => {
  const authUrl =
    `${config.JOBBER_AUTH_URL}?` +
    `client_id=${encodeURIComponent(config.JOBBER_CLIENT_ID)}&` +
    `redirect_uri=${encodeURIComponent(config.REDIRECT_URI)}&` +
    `response_type=code&` +
    `scope=read_vehicles,write_vehicles`;
  res.redirect(authUrl);
});

// OAuth callback
app.get("/auth/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect("/?error=" + encodeURIComponent(error));
  }

  if (!code) {
    return res.redirect("/?error=invalid_request");
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      config.JOBBER_TOKEN_URL,
      {
        grant_type: "authorization_code",
        client_id: config.JOBBER_CLIENT_ID,
        client_secret: config.JOBBER_CLIENT_SECRET,
        code: code,
        redirect_uri: config.REDIRECT_URI,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Store tokens in session
    req.session.accessToken = access_token;
    req.session.refreshToken = refresh_token;

    res.redirect("/?authenticated=true");
  } catch (error) {
    console.error(
      "Token exchange error:",
      error.response?.data || error.message
    );
    res.redirect("/?error=token_exchange_failed");
  }
});

// Check authentication status
app.get("/api/auth/status", (req, res) => {
  res.json({
    authenticated: !!req.session.accessToken,
    hasToken: !!req.session.accessToken,
  });
});

// Logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Create vehicle using native Node.js https (to bypass Cloudflare bot detection)
app.post("/api/vehicles", async (req, res) => {
  console.log("Vehicle creation request received:", req.body);

  if (!req.session.accessToken) {
    console.log("No access token found in session");
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { name, make, model, year } = req.body;
  console.log("Extracted data:", { name, make, model, year });

  if (!name || !make || !model || !year) {
    console.log("Missing required fields");
    return res
      .status(400)
      .json({ error: "Name, make, model, and year are required" });
  }

  const mutation = `
    mutation CreateVehicle($input: VehicleCreateInput!) {
      vehicleCreate(input: $input) {
        vehicle {
          id
          name
          make
          model
          year
        }
        userErrors {
          message
          path
        }
      }
    }
  `;

  const variables = {
    input: {
      name: name,
      make: make,
      model: model,
      year: parseInt(year),
    },
  };

  console.log("Making GraphQL request to:", config.JOBBER_GRAPHQL_URL);
  console.log("With variables:", variables);
  console.log(
    "Access token (first 20 chars):",
    req.session.accessToken.substring(0, 20) + "..."
  );
  console.log(
    "Full Authorization header:",
    `Bearer ${req.session.accessToken}`
  );

  // Let's also try to decode the JWT to see what's in it
  try {
    const tokenParts = req.session.accessToken.split(".");
    if (tokenParts.length === 3) {
      const payload = JSON.parse(
        Buffer.from(tokenParts[1], "base64").toString()
      );
      console.log("JWT payload:", payload);
      console.log("Token expires at:", new Date(payload.exp * 1000));
      console.log("Current time:", new Date());
      console.log("Token expired?", payload.exp * 1000 < Date.now());
    }
  } catch (e) {
    console.log("Could not decode JWT:", e.message);
  }

  // Test if the token works with a simple API call first
  console.log("Testing token with a simple GraphQL query...");
  try {
    const testQuery = `query { viewer { id } }`;
    const testOptions = {
      hostname: "api.getjobber.com",
      port: 443,
      path: "/api/graphql",
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.session.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-JOBBER-GRAPHQL-VERSION": "2025-01-20",
        "Content-Length": Buffer.byteLength(
          JSON.stringify({ query: testQuery })
        ),
      },
    };

    const testResponse = await new Promise((resolve, reject) => {
      const testReq = https.request(testOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
          });
        });
      });
      testReq.on("error", (error) => {
        reject(error);
      });
      testReq.write(JSON.stringify({ query: testQuery }));
      testReq.end();
    });

    console.log("Test query response status:", testResponse.statusCode);
    if (testResponse.statusCode !== 200) {
      console.log("Test query failed - headers:", testResponse.headers);
      console.log("Test query failed - data:", testResponse.data);
    } else {
      console.log("Test query succeeded! Token appears valid.");
    }
  } catch (testError) {
    console.log("Test query error:", testError.message);
  }

  try {
    const postData = JSON.stringify({
      query: mutation,
      variables: variables,
    });

    const options = {
      hostname: "api.getjobber.com",
      port: 443,
      path: "/api/graphql",
      method: "POST",
      headers: {
        Authorization: `Bearer ${req.session.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-JOBBER-GRAPHQL-VERSION": "2025-01-20",
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    };

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data,
          });
        });
      });

      req.on("error", (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });

    console.log("GraphQL response status:", response.statusCode);
    console.log("GraphQL response headers:", response.headers);
    console.log("GraphQL response data:", response.data);

    if (response.statusCode === 301 || response.statusCode === 302) {
      console.log("Redirect detected to:", response.headers.location);
      throw new Error(
        `HTTP ${response.statusCode}: Redirect to ${response.headers.location}`
      );
    }

    if (response.statusCode !== 200) {
      throw new Error(`HTTP ${response.statusCode}: ${response.data}`);
    }

    const result = JSON.parse(response.data);

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return res
        .status(400)
        .json({ error: "GraphQL errors", details: result.errors });
    }

    const vehicleResult = result.data.vehicleCreate;

    if (vehicleResult.userErrors && vehicleResult.userErrors.length > 0) {
      console.log("Validation errors:", vehicleResult.userErrors);
      return res.status(400).json({
        error: "Validation errors",
        details: vehicleResult.userErrors,
      });
    }

    console.log("Vehicle created successfully:", vehicleResult.vehicle);
    res.json({ success: true, vehicle: vehicleResult.vehicle });
  } catch (error) {
    console.error("Vehicle creation error:", error);

    if (
      error.message &&
      (error.message.includes("401") || error.message.includes("403"))
    ) {
      req.session.destroy();
      return res
        .status(401)
        .json({ error: "Authentication expired", needsReauth: true });
    }

    res
      .status(500)
      .json({ error: "Failed to create vehicle", details: error.message });
  }
});

// Start server
app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
  console.log(
    `Click here to start OAuth flow: http://localhost:${config.PORT}/auth/login`
  );
});

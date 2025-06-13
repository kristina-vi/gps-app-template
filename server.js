const express = require("express");
const axios = require("axios");
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
    `response_type=code&`;
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

// Create vehicle endpoint - uses native Node.js https for direct GraphQL API calls
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

  // Test if the token works with a simple API call first
  console.log("Testing token with a simple GraphQL query...");
  try {
    const testQuery = `query { viewer { id } }`;
    const testResponse = await axios.post(
      config.JOBBER_GRAPHQL_URL,
      {
        query: testQuery,
      },
      {
        headers: {
          Authorization: `Bearer ${req.session.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-JOBBER-GRAPHQL-VERSION": config.API_VERSION,
        },
      }
    );

    console.log("Test query response status:", testResponse.status);
    console.log("Test query succeeded! Token appears valid.");
  } catch (testError) {
    console.log(
      "Test query error:",
      testError.response?.status,
      testError.response?.data || testError.message
    );
  }

  try {
    // Make GraphQL request to create vehicle
    const response = await axios.post(
      config.JOBBER_GRAPHQL_URL,
      {
        query: mutation,
        variables: variables,
      },
      {
        headers: {
          Authorization: `Bearer ${req.session.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-JOBBER-GRAPHQL-VERSION": config.API_VERSION,
        },
      }
    );

    console.log("GraphQL response status:", response.status);
    console.log("GraphQL response data:", response.data);

    // Check for GraphQL errors
    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      return res.status(400).json({
        error: "GraphQL errors",
        details: response.data.errors,
      });
    }

    const vehicleResult = response.data.data.vehicleCreate;

    // Check for user validation errors
    if (vehicleResult.userErrors && vehicleResult.userErrors.length > 0) {
      console.log("Validation errors:", vehicleResult.userErrors);
      return res.status(400).json({
        error: "Validation errors",
        details: vehicleResult.userErrors,
      });
    }

    // Success - return the created vehicle
    console.log("Vehicle created successfully:", vehicleResult.vehicle);
    res.json({ success: true, vehicle: vehicleResult.vehicle });
  } catch (error) {
    console.error(
      "Vehicle creation error:",
      error.response?.data || error.message
    );

    // Handle authentication errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      req.session.destroy();
      return res.status(401).json({
        error: "Authentication expired",
        needsReauth: true,
      });
    }

    res.status(500).json({
      error: "Failed to create vehicle",
      details: error.response?.data || error.message,
    });
  }
});

// Start server
app.listen(config.PORT, () => {
  console.log(`Server running on http://localhost:${config.PORT}`);
  console.log(
    `Click here to start OAuth flow: http://localhost:${config.PORT}/auth/login`
  );
});

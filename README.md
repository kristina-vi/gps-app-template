# Jobber OAuth API Template

A Node.js template for building applications that integrate with Jobber's API using OAuth 2.0 and GraphQL.

## Features

- 🔐 OAuth 2.0 authentication with Jobber
- 🔌 GraphQL API integration
- 🚗 Example: Create vehicles with make, model, year, and name
- 🛡️ Secure session-based token storage

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- A Jobber developer account with OAuth app configured
- A Jobber test (SP) account, which we will connect to the app

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/kristina-vi/gps-app-template.git
   cd gps-app-template
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure your Jobber OAuth app:**

   - Go to your Jobber developer dashboard
   - Set the redirect URI to: `http://localhost:3001/auth/callback`
   - Note down your Client ID and Client Secret

4. **Set up configuration:**

   Copy the example config file and add your credentials:

   ```bash
   cp config.example.js config.js
   ```

   Edit `config.js` and add your actual credentials:

   ```javascript
   // config.js
   module.exports = {
     CLIENT_ID: "your-actual-client-id",
     CLIENT_SECRET: "your-actual-client-secret",
     // ... other settings
   };
   ```

## Usage

1. **Start the server:**

   ```bash
   npm start
   ```

   For development with auto-restart:

   ```bash
   npm run dev
   ```

2. **Open your browser:**
   Navigate to `http://localhost:3001`

3. **Authenticate with Jobber:**

   - Click "Connect with Jobber"
   - You'll be redirected to Jobber's authorization page
   - Grant the required permissions
   - You'll be redirected back to the application

4. **Use the API:**
   - The template includes a sample vehicle creation form
   - Fill out the form with make, model, year, and name
   - Click "Create Vehicle" to test the GraphQL API
   - Customize the API calls for your specific use case

## Project Structure

```
├── server.js          # Express server with OAuth and GraphQL integration
├── config.js          # Configuration file with OAuth credentials (gitignored)
├── config.example.js  # Example configuration file for setup
├── package.json       # Node.js dependencies and scripts
├── .gitignore         # Git ignore rules
├── public/
│   ├── index.html     # Frontend HTML
│   └── script.js      # Frontend JavaScript for API communication
└── README.md          # This file
```

## OAuth Flow

1. User clicks "Connect with Jobber"
2. Application redirects to Jobber's authorization server
3. User grants permissions
4. Jobber redirects back with authorization code
5. Application exchanges code for access token
6. Access token is stored in session
7. User can now create vehicles

## GraphQL Integration

This template demonstrates GraphQL API usage with a `vehicleCreate` mutation example:

```graphql
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
      field
      message
    }
  }
}
```

## Customizing for Your Use Case

This template uses vehicle creation as an example. To adapt it for your needs:

1. **Replace the GraphQL mutation** in `server.js` with your desired Jobber API operations
2. **Update the frontend form** in `public/index.html` to match your data requirements
3. **Modify the API endpoint** in `server.js` (currently `/api/vehicles`) to match your functionality
4. **Update validation and error handling** as needed for your specific use case

You can integrate with any part of Jobber's GraphQL API - clients, jobs, invoices, team members, etc.

## Error Handling

The application handles various error scenarios:

- OAuth authentication errors
- Token expiration
- GraphQL validation errors
- Network connectivity issues
- Form validation errors

## Security Features

- Client secret is kept on the server (not exposed to frontend)
- OAuth state parameter prevents CSRF attacks
- Session-based token storage
- Input validation and sanitization

## Troubleshooting

### Common Issues

1. **"Authentication failed"**

   - Verify your Client ID and Client Secret in `config.js`
   - Ensure the redirect URI matches exactly in your Jobber app settings

2. **"Failed to create vehicle"**

   - Verify all form fields are filled correctly
   - Check that your Jobber app has permission to create vehicles

3. **"Session expired"**
   - Click "Connect with Jobber" to re-authenticate

## Production Deployment

Before deploying to production:

1. **Environment Variables:**

   - Move credentials to environment variables
   - Set `SESSION_SECRET` to a secure random string

2. **Security:**

   - Enable HTTPS
   - Set `cookie.secure: true` in session configuration
   - Update CORS settings for your domain

3. **Redirect URI:**
   - Update the redirect URI in your Jobber app settings
   - Update `REDIRECT_URI` in your configuration

## Support

For issues with:

- **Jobber API:** Check the [Jobber Developer Documentation](https://developer.getjobber.com/docs)
- **This application:** Review the troubleshooting section above

## License

This project is provided as-is for demonstration purposes.

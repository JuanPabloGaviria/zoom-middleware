# Zoom WebSocket Integration Guide

This guide explains how to set up and troubleshoot the Zoom WebSocket connection used in this application.

## Prerequisites

Before you begin, ensure you have the following:

1. A Zoom Developer account
2. A Zoom App with WebSocket capabilities enabled
3. Your Zoom Account ID, Client ID, Client Secret, and Subscription ID

## Configuration

### Required Environment Variables

The application requires the following environment variables to connect to Zoom's WebSockets:

```
ZOOM_ACCOUNT_ID=your_account_id
ZOOM_CLIENT_ID=your_client_id
ZOOM_CLIENT_SECRET=your_client_secret
ZOOM_SUBSCRIPTION_ID=your_subscription_id
ZOOM_WS_URL=wss://ws.zoom.us/ws
```

### Zoom App Configuration

1. Log in to the [Zoom Developer Dashboard](https://marketplace.zoom.us/)
2. Navigate to your WebSocket app
3. Ensure the "Event Subscriptions" section has the appropriate events selected:
   - `recording.completed` - For automated processing of recordings

## Troubleshooting

### Common Issues

#### 1. "Token is empty" Error

When you see this error in the logs, it indicates that the OAuth token is not being correctly passed to the WebSocket connection.

**Solution:**
- Verify that your Client ID and Client Secret are correct
- Ensure the Account ID matches the Zoom account where the app is installed
- Check that the WebSocket URL includes the access token as a query parameter

#### 2. Connection Closes Immediately

If the WebSocket connection establishes but then closes immediately:

**Solution:**
- Check the Subscription ID is correct
- Ensure your app has the required event subscriptions enabled
- Verify the account has the necessary permissions

#### 3. No Events Being Received

If the connection is established but you're not receiving events:

**Solution:**
- Verify events are being generated (e.g., recordings being completed)
- Check that the subscription is configured for the correct events
- Ensure the Zoom user account has the necessary permissions

## Testing the Connection

You can test the WebSocket connection using the built-in test script:

```
npm run test:ws
```

This script will:
1. Attempt to obtain an OAuth token
2. Connect to the Zoom WebSocket
3. Maintain the connection for 30 seconds
4. Log all received messages

## Official Documentation

For more information, refer to Zoom's official documentation:
- [Zoom WebSockets API](https://developers.zoom.us/docs/api/rest/websockets/)
- [Zoom OAuth](https://developers.zoom.us/docs/internal-apps/oauth/)
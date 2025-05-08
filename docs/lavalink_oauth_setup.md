# How to Obtain a YouTube OAuth Refresh Token for Lavalink

This guide explains how to generate a **refresh token** for the Lavalink YouTube plugin (`youtube-source`) to enable OAuth authentication, which helps bypass some restrictions and improve playback reliability.

---

## ⚠️ Important Warnings

- **Use a burner Google account!**  
  Do **NOT** use your main/personal Google account. OAuth tokens can be sensitive, and misuse may risk your account.

- This process uses Google's official OAuth flow, but **you are responsible** for your account's safety.

---

## Step-by-Step Instructions

### 1. Enable OAuth in your Lavalink `application.yml`

In your Lavalink config, under the YouTube plugin section, enable OAuth:

```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true
```

Leave `refreshToken` commented out or empty for now.

---

### 2. Start Lavalink

Run Lavalink **with the YouTube plugin enabled and OAuth enabled** as above.

---

### 3. Complete the OAuth Flow

- When Lavalink starts, it will **output a URL** in the console logs.
- Open this URL in your browser.
- You will be prompted to **sign in with your burner Google account**.
- Grant the requested permissions.
- You will receive a **code** to paste back into the console or the flow will complete automatically.

---

### 4. Retrieve Your Refresh Token

- After successful authentication, **Lavalink will print your refresh token** in the console logs.
- Look for a line similar to:

```
Your refresh token is: ya29.a0ARrdaM...
```

- **Copy this refresh token** and keep it safe.

---

### 5. Save the Refresh Token in Your Config

Update your `application.yml`:

```yaml
plugins:
  youtube:
    enabled: true
    oauth:
      enabled: true
      refreshToken: "paste-your-refresh-token-here"
      skipInitialization: true
```

- Setting `skipInitialization: true` prevents Lavalink from prompting the OAuth flow again.
- Restart Lavalink.

---

## Additional Notes

- You only need to perform this process **once per account**.
- If the refresh token expires or is revoked, repeat the process.
- For more details, see the [official youtube-source README](https://github.com/lavalink-devs/youtube-source/blob/main/README.md).

---

## Back to Main Setup

Return to the [Main README](./README.md) for general bot setup instructions.

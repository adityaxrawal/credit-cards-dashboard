import { google } from 'googleapis'

const auth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
)

export const gmail = google.gmail({ version: 'v1', auth })
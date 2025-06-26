# LinkedIn Auto-Connect Chrome Extension

## Features
- Auto-send LinkedIn connection requests from Google search results
- Specify role, company, location, message, and number of requests
- Uses a single tab (no tab explosion)
- Random delay between actions for safety

## Setup
1. Clone or download this repo
2. Open Chrome → Extensions → Load Unpacked → Select this project folder
3. Log into LinkedIn manually
4. Click the extension icon → Enter filters → Start

## Usage
- Enter Role, Company, Location, Optional Message, and Limit
- Click "Add Connections"
- The extension will:
  - Perform a Google search for LinkedIn profiles
  - Scrape the first N profile links
  - Open each profile in the same tab, send a connection request with your message
  - Wait 6–10 seconds between each action

## Safety Notes
- Delay between each request: 6–10s
- Max 20 requests/session
- No login automation (user logs in manually)

## Disclaimer
Use responsibly and in accordance with LinkedIn's terms of service. 
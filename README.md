<h1 align="center">KTU Bot</h1>

<p align="center">
  <img align="center" width="200" src="https://i.imgur.com/obaTlOd.jpeg">
</p>

<br/>
<div align="center">

![Made with telegrafjs](https://img.shields.io/badge/Made%20With-Telegraf.JS-%23E74625?style=flat&link=https%3A%2F%2Ftelegraf.js.org%2F)

</div>
<br/>


> [!NOTE]
>
> This project is currently in autopilot mode and will not receive any major updates. It may become broken at any point in time, as I personally don't have much time to work on it. The functionality of this bot heavily depends on KTU APIs, and any significant changes to those APIs could break the bot. If you're interested in maintaining this project, feel free to fork it or contact me for assistance.


Welcome to the KTU Bot! This Telegram bot helps students check their exam results, find latest KTU notifications, academic calendars, exam time tables and alert users when new notifications arrive.

Find the bot [here](https://t.me/ktu_results_bot)

## Table of Contents

- [KTU Bot](#ktu-bot)
  - [Features](#features)
  - [Commands](#commands)
  - [Inline Query](#inline-query)
  - [Local development setup](#local-development-setup)
    - [Running Locally (Without Docker - Not preferred)](#running-locally-without-docker---not-preferred)
    - [Running with Docker Compose (Preferred)](#running-with-docker-compose-preferred)
  - [Production setup](#production-setup)
    - [Pre-requisites](#pre-requisites)
    - [Steps](#steps)
  - [Contributing](#contributing)
  - [Bugs and Feedback](#bugs-and-feedback)
  - [License](#license)

## Features

- **Check Results**: Easily check latest published KTU results.
- **Check old results**: Check any results ever published in the history of KTU (yeah for real) (REMOVED).
- **Download published KTU notifications**: Browse and download any published KTU notification.
- **Dowbload published academic calendars**: Browse and download any published KTU academic calendars.
- **Download published exam time tables**: Browse and download any published KTU exam time tables.
- **Subscribe to latest KTU notifications**: Get alerted when new notifications arrive.
- **Filtered notifications**: Only recieve notifications that you care about. No trash.
- **Live search notifications**: Search and download published notifications using the keyword.

## Commands

- `/start`: Start the bot and get a welcome message.

- `/help`: Show a help message with available commands.

- `/result`: Fetch your exam results.

- `/oldresults`: Fetch previously published exam results (Removed).

- `/notifications`: Find and download latest KTU notifications.

- `/calendar`: Find and download published KTU academic calendars.

- `/timetable`: Find and download published KTU exam time tables.

- `/subscribe`: Subscribe to recieve latest KTU notifications as they arrive.

- `/unsubscribe`: Unsubscribe from recieving KTU notifications.

- `/changefilter`: Change currently set notification filter.

- `/cancel`: Cancel ongoing process.

- `/code` : See project source code.

## Inline Query

Use inline query to live search the notification you want to. No more pain of scrolling through the webpage for the notification.

```
eg: @ktu_results_bot calendar : This returns all the results that matches word "calendar" like Academic calendars etc.
```

## Local development setup

> [!NOTE]
>
> The bot makes use of [BullMQ](https://github.com/taskforcesh/bullmq), a redis based NodeJS queue, for the live notifications feature. Thus, it requires you to have a redis instance running.
> The docker compose method below already does that for you.

### Running Locally (Without Docker - Not preferred)

1. Install Node.js and npm on your machine.
2. Clone the repository:

   ```bash
   git clone https://github.com/devadathanmb/ktu-bot.git
   ```

3. Navigate to the project directory:

   ```bash
   cd ktu-bot
   ```

4. Install dependencies:

   ```bash
   npm install
   ```

5. Set up your Telegram bot token:

   - Create a new bot on Telegram using the [BotFather](https://core.telegram.org/bots#botfather).
   - Copy the bot token.
   - Create a `.env` file in the project root and add:

     ```env
     BOT_TOKEN="your-telegram-bot-token"
     ```

     See [env.example]("./env.example") file for example

6. Create a Firebase project and setup a Firestore database in [Firebase console](https://console.firebase.google.com/u/0/)

7. Download the `serviceAccountKey.json` file, `minify` it and `base64` encode it using

   ```bash
   jq -r tostring serviceAccountKey.json  | base64
   ```

8. Copy the `base64` encoded `serviceAccountKey.json` string to `.env`

   ```
   FIREBASE_SERVICE_ACCOUNT="base64 encoded string"
   ```

9. Set the `ENV_TYPE` variable to `DEVELOPMENT` in `.env`

   ```
   ENV_TYPE="DEVELOPMENT"
   ```

10. Build the bot:

    ```bash
    npm run build
    ```

11. Start the bot:

    ```bash
    npm run start
    ```

### Running with Docker Compose (Preferred)

1. Install Docker and Docker Compose on your machine.

2. Clone the repository:

   ```bash
   git clone https://github.com/devadathanmb/ktu-bot.git
   ```

3. Navigate to the project directory:

   ```bash
   cd ktu-bot
   ```

4. Create a `.env` file in the project root and add:

   ```env
   BOT_TOKEN="your-telegram-bot-token"
   ```

5. Create a Firebase project and setup a Firestore database in [Firebase console](https://console.firebase.google.com/u/0/)

6. Download the `serviceAccountKey.json` file, `minify` it and `base64` encode it using

   ```bash
   jq -r tostring serviceAccountKey.json  | base64
   ```

7. Copy the `base64` encoded `serviceAccountKey.json` string to `.env`

   ```
   FIREBASE_SERVICE_ACCOUNT="base64 encoded string"
   ```

8. Set the `ENV_TYPE` variable to `DEVELOPMENT` in `.env`

   ```
   ENV_TYPE="DEVELOPMENT"
   ```

9. Make sure to add all necessary environment variables to `.env` mentioned in [env.example](./env.example)

10. Run the application using Docker Compose:

    ```bash
    docker-compose -f docker-compose.dev.yml up
    ```

The bot should now be running and accessible on Telegram.

> [!NOTE]
> The bot will automatically pickup changes in `./src` and restart the bot.

## Production setup

This bot makes use of Telegram bot API's [webhook](https://core.telegram.org/bots/webhooks) mechanism in production.

This is because of certain performance benefits that webhook offers with high concurrent load during peak times. For more info see [this](https://grammy.dev/guide/deployment-types#how-to-use-webhooks).

> [!NOTE]
> Using webhooks in production is optional but recommended if your bot has heavy concurrent traffic. If you don't want to setup webhooks, just follow the above development setup guide and you are good to go.

### Pre-requisites

To run the bot using webhooks in production, some pre-requisites are required. They are mentioned below:

- A VPS
- A domain
- SSL certificate for the domain (you can use [let's encrypt](https://letsencrypt.org/) for that)
- Docker
- A reverse proxy (like [nginx](https://www.nginx.com/))

> [!NOTE]
> The below guide makes use of _nginx_ as the reverse proxy and assumes that you have reverse proxy configured for the webhook endpoint with HTTPS traffic handling

### Steps

1. Set up an nginx reverse proxy for the webhook endpoint. See [this](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/) for more information. Checkout basic example in [webhook.conf](./webhook.conf)

2. Clone the repository using

   ```bash
   git clone https://github.com/devadathanmb/ktu-bot.git && cd ktu-bot/
   ```

3. Set `ENV_TYPE=PRODUCTION` in `.env` file. See [env.example](./env.example)

4. Make sure to add all necessary environment variables to `.env` mentioned in [env.example](./env.example)

5. Build and run the docker using `docker compose up -d`

6. Start the nginx server (eg : `sudo systemctl restart nginx`)

That's it. Your bot should be running now in webhook mode.

## Contributing

If you encounter any issues, have feature suggestions, or want to contribute to the project, please feel free to fork and make a PR.

## Bugs and Feedback

If you find any bugs or have feedback, please [open an issue](https://github.com/devadathanmb/ktu-bot/issues) on GitHub.

## License

This project is licensed under the GPL 3.0 License - see the [LICENSE.md](./LICENSE.md) file for details.

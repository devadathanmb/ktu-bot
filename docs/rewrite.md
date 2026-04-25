# KTU Bot v2: The Rewrite Story

## Background

This project started as a 50-line script I wrote on a weekend in October 2023 to check my own results. If you dig through the git history and find the [first commit](https://github.com/devadathanmb/ktu-bot/commit/bba797b9576428dbaed895616a0acd992ad63a80), that's where it all began. I was frustrated with how terrible the official KTU website was at the time - despite being rewritten in [React](https://react.dev/) from their old [PHP](https://www.php.net/) mess, it was still a disaster. There was no proper state management, the UI broke if you selected things in a different order, and the page would just load blank even when their API was actually up during high traffic. The whole thing was a complete mess. Not claiming it's changed much since then - I still see at least one person ranting about this every week or so in [r/KtuKerala](https://www.reddit.com/r/KtuKerala/)

I already had some experience with the [Telegram Bot API](https://core.telegram.org/bots/api) and the ecosystem around it. It's probably one of the easiest clients to build within a day without having to write an entire UI. That's how the initial version came to life - very dead simple, just enough to get the job done.

Then something unexpected happened. I started noticing new [chat IDs](https://core.telegram.org/bots/api#chat) popping up in the logs. People were somehow finding this bot despite me not linking it anywhere and actually using it. From there, it spread like wildfire. When results got published, the bot link was shared in almost every group, and it became the first thing people used to check their results - yes, even before they check from the official website.

The initial version wasn't built for the scale it ended up receiving. It did a lot of things the wrong way, which I eventually learned and fixed on the go. I put in a lot of time and effort to polish it as much as I could. Added features like checking old results (literally any result published in the history of this university - which was basically a hack with their API), and a lot of things came and went along the way.

After I graduated, I barely had time to work on this. As it got popular, other similar projects also came along. I had already open-sourced everything for anyone who wanted to build on it. But then, for some reason, the university started actively trying to kill third-party API consumers including this bot ([see issue #12](https://github.com/devadathanmb/ktu-bot/issues/12)). I'd get messages from those awesome users saying the bot was dead and not working. For the first few times, I invested time trying to bring it back up, but then it felt like a cat and mouse game - Something would break when I fix it.

I still don't really understand why they're trying to kill it (or if they are?) - the whole point of making this open source was to ensure transparency that it doesn't collect or share any data ever. The API is just dumping some basic data that has nothing sensitive anyways. But anyways, as a result of the back and forth, it remained dead for a long time, although I still had it hosted in my homelab alongside other containers I run.

## So Why the Rewrite? 🤔

After I added that note to the project README saying it would no longer be maintained, I realized how bad the code actually looked. The thing I once thought was good suddenly felt ugly. It did a lot of things right but did more things wrong. Even more than the code, the most infuriating part was the entire ecosystem of tools it used. Since the whole idea back then was just to get it working and jumping on hype trains (lol), I had gone with the tools that were opinionated and trendy instead of doing things the right way. For example:

### 1. Telegraf - The Framework Nightmare

The bot used [Telegraf v4](https://github.com/telegraf/telegraf) as its main Bot API framework. Don't get me wrong - Telegraf is good, and in fact, it was the only usable framework for a long time. It's still the most starred one (at the time of writing this), but it had [a lot of issues](https://grammy.dev/resources/comparison#telegraf). Telegraf wizards were such a pain to work with - needing to repeat a lot of cryptic code that I don't even understand now. Even the TypeScript types were so messed up that my code editor took 5 seconds to load LSP completions once the project grew out. This was more infuriating than the code itself because even if I found time, the whole dev setup was so broken that I couldn't test or patch things properly.

Telegraf is almost a dead project currently - it usually lags several weeks to months behind Bot API updates, and the much-needed v5 version is nowhere in sight. But I'm thankful for Telegraf, its maintainers, and the entire community for the help I got while building this. I learned a lot about how to scale and do things right from their awesome [Telegram group](https://t.me/TelegrafJSChat).

If you're planning to build something on top of the Bot API, I wouldn't recommend Telegraf - even though it's probably the first suggestion you'll get from ChatGPT.

### 2. Firebase - Why Did I Do This to Myself?

I have no clue why I decided to go with the [Firebase](https://firebase.google.com/) suite while building this. I doubt it was mostly just going with the trend. The most painful thing about using Firebase is that you cannot ever have a fully local dev setup without configuring a testing Firebase project or pulling the entire [Firebase Local Emulator Suite](https://firebase.google.com/docs/emulator-suite). This is bad - it should never be so hard to run a project locally. I always had to copy around the `.env` for the service account JSON nonsense, base64 encode it further so Docker doesn't get messed up, and what not. It was exhausting to say the least.

### 3. Monolithic Mess

In the older version, everything ran as a single process. The node cron job, the broadcast setup, the bot - all ran as part of a single build. This is honestly bad design. It creates multiple things to worry about and error boundaries so obscure that you have no clue what's going wrong where. The codebase was designed in a way that made it even more difficult to maintain. Its almost often not about scaling but about maintaining. I don't think splitting things up makes a huge difference for scaling in this case - a bot's capabilities are pretty limited compared to traditional web apps unless you self-host the Bot API servers. The only real option is to respect Telegram's rate limits and work around them.

Moreover, I realized how big of a pain and demotivation it is for someone to actually try to contribute or fork it for their own use case. The code was felt cryptic and daunting (I think we can blame the tools here also lol).

These kinds of things always bug me - maybe it's because of my obsession with tech - which eventually made me make `rm -rf` the old bot and start fresh with `mkdir new-bot`

## Finally Rewriting ⚡

I started finding some time on weekends to tackle this. With AI copiloting, I knew it would be easier since most of the heavy lifting was already done and we just needed to refactor and reorganize things. I had a clear idea this time about what tools to use.

### 1. GrammY - The Framework Done Right

[GrammY](https://grammy.dev/) is literally the best bot development framework I've seen to date. I know there are some popular ones in the Python world, but the amount of effort their team has put into documentation is insane - which is what Telegraf absolutely lacked. Telegraf had zero docs except basic getting started guides and TypeScript type definitions (understanding which in itself takes a day).

GrammY's team has thought of everything that makes bot development easy. They have a great ecosystem of [extensible plugins](https://grammy.dev/plugins/), excellent typing support, and [documentation](https://grammy.dev/guide/) that actually helps you understand concepts. All of this makes GrammY an amazing choice for writing bots.

### 2. PostgreSQL - The Database I Should've Used From Day 1

I needed to run the database locally. So Firebase had to go, and over time I've realized how powerful [PostgreSQL](https://www.postgresql.org/) is - and how powerful SQL databases are in general. Postgres was a no-brainer choice. It even supports features like [full-text search](https://www.postgresql.org/docs/current/textsearch.html) that make things incredibly powerful (and a ton of features which I don't even know about). To make things easy, I found [Drizzle ORM](https://orm.drizzle.team/docs/get-started/postgresql-new) that was lightweight yet very powerful.

### 3. Separation of Concerns - Doing It Right This Time

This was also a no-brainer. I had to decouple the bot from other services and do broadcasts the right way, even if it meant splitting things into multiple independent services. This makes the project maintainable in the long run and creates clear boundaries for errors and future development. You can read more about the current setup here: [How It Works](./working.md)

### The Rest of the Stack

The rest was mostly choosing things that felt right to me:

- Ditched HTML parsing and started using [formatted strings that GrammY provides](https://grammy.dev/plugins/parse-mode.html)
- Ditched [axios](https://axios-http.com/) for a more modern solution and ended up with [got](https://github.com/sindresorhus/got)
- Realized that Hugging Face doesn't provide free inference endpoints anymore, so had to switch LLM providers (currently using [Groq](https://groq.com/)) for the relevancy checks
- Made some changes to the database schema and introduced additional tables for metadata
- Set up proper [Docker Compose](https://docs.docker.com/compose/) orchestration for all services with a proper working out of the box dev setup
- Rewrote the whole [BullMQ](https://docs.bullmq.io/) setup for more reliable broadcasting
- Added proper healtchecks and queue monitoring because logs can only do so much?

And yeah, within a few weekends, it all started coming together. Finally, it ended up as a working, maintainable project that I actually found decent.

---

## Commonly Asked Questions 💬

### "Results not working" 😢

This is literally the most commonly asked question. Yes, I know it's broken ([see this issue](https://github.com/devadathanmb/ktu-bot/issues/12)), and it's not the bot's fault.

I don't exactly recall when, but somewhere in early 2025, KTU entirely removed the result checking API endpoint. They made signing into the student portal the only way to check results. I'm not sure why - maybe they didn't like other clients using those APIs - but nevertheless, it was removed entirely. And this is what the bot uses for data.

**This bot is essentially a smart API consumer** (Read more about how it works here - [How does this work?](./working.md#this-isn't-magic)) - it accesses data the same way the website accesses data. So anything that's not accessible through the website (a public HTTP endpoint) is not accessible to the bot either. And no, we cannot fix it. Unless they expose a way to check results without logging in, it's simply impossible.

We _could_ technically make it work by requiring users to sign in to the student portal with their registration number and password, then fetching the data on their behalf. But this is **more dangerous** than what it gains. Unless it's something you built for you and your friends, giving your credentials (whatever account it may be) to random inputs is dangerous. It could even become directly illegal, so that's something the bot will never implement because it shouldn't be done that way.

> [!IMPORTANT]
> **Will this be fixed?**
>
> I don't know. The bot cannot access your result data until KTU exposes it publicly. As long as they don't, it will remain a dead feature.
>
> I know it's sad to hear but we have to live with it for now.

### Is this bot officially associated with KTU?

No. This is in no way officially associated with KTU. It relies on the public API endpoints that KTU exposes. This is an independent, open-source project built by the community, for the community.

### Will the bot continue to work?

I don't know about this either. Like mentioned above, the bot is essentially an API consumer. Any changes to the API schema at their end - whether _intentional or accidental_ - will break the bot. There have been instances where they've done this before (see [this discussion](https://github.com/devadathanmb/ktu-bot/issues/11#issuecomment-2452926932)). Maybe by the time you're reading this, the bot is already dead again. 🤷‍♂️

### Does that mean all the effort went to waste?

**Not at all.** This bot is a prime example of how an API consumer can do engineering better than the actual tool itself - and I'm being really honest here.

For example, while rewriting, I realized how the search functionality for announcements was removed from the website despite their API still sending that data in the payload. This is such a basic feature that should exist from day 1! That's when I wrote the whole [data sync worker](./working.md#data-sync-worker-) and implemented full-text search using PostgreSQL. There is a reason why people found their results through the bot while the website threw `502` errors at them 🙂 - which is basically engineering done right with whatever was available!

The whole experience offered by the official website is still subpar. Although a lot of things like responsive design have been fixed today, there's still no proper loading state, no correct state management in user actions, and a bunch of other issues that make for poor UX. What makes it even funnier is that students from this very university have built webapps that are out of the world! And this is the reason why the entire thing is a meme at this point. It's not always about server capacity - sometimes (and most often) it's just poor engineering that makes the experience terrible.

Even if they change something (again, intentionally or unintentionally) that kills the bot and makes it not even patchable, it will remain as a piece of work showing how an API consumer can do better engineering than the actual website itself, and how it made an impact on thousands of students.

### Will it receive more updates?

I'm not sure. I don't have the time I had back in college to work on this project now. I can only spend limited time on weekends, and I believe it's sort of a finished project. I can't think of anything specific that would make this bot significantly better right now.

But like I said, the main reason for rewriting this entire project was to make sure others can fork it, contribute, extend it, and make their own versions - or at least use it as a good starting point for similar projects. So if you think you have an idea, [create an issue](https://github.com/devadathanmb/ktu-bot/issues/new) and let's talk!

### Where to host it if I make my own? 🚀

The whole thing is built piece by piece. If you don't want a feature, it's as simple as commenting out a few lines of code and removing that service from `docker-compose`. You can host it anywhere - in fact, you can host each service in different places and it will still work.

Some options:

- [Vercel](https://vercel.com/) — Free tier available. Also covered in GrammY docs.
- [Render](https://render.com/) - Free tier available
- [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform) - Easy Docker deployment
- [Fly.io](https://fly.io/) - Good free tier for side projects
- Your own [homelab](https://www.reddit.com/r/homelab/) - What I use!

All the popular free hosting services will work with some tweaking. AI can help you out there.

### Something's not working... 🐛

Yeah, likely something may not work. Bugs are everywhere, especially when you do such massive rewrites. There's always a chance you overlooked something. Real testing happens in prod - that's when you see the performance bottlenecks, the database timeouts, and race conditions.

If you find something broken, please [create an issue](https://github.com/devadathanmb/ktu-bot/issues/new). Include:

- What you were trying to do?
- What happened instead?

This will help me or anyone else looking at the issue figure out what the issue is and attempt to fix it.

### Does this have ads? Do you make money from this? 💰

**No.** This is 100% [libre](https://en.wikipedia.org/wiki/Free_software). It never had and never will have ads or anything unsolicited.

And no, I don't make anything out of this. In fact, I've spent quite some money on hosting services in the past (Yes. I took one for the community). Now, I can afford to host it alongside my other personal projects/services. More importantly, I host it on my own little [homelab](https://www.reddit.com/r/homelab/) setup that runs nearly 24×7, so no more cloud costs. And all of the external services it uses have generous free tiers, thankfully.

If you want to support the project, the best way is to contribute code, report bugs, or help others who are stuck. That means more than money ever could. ❤️

---

**That's the story!** This rewrite was about doing things right, making it maintainable, and ensuring anyone can build on it. Whether the bot survives or not, the code will remain as a testament to what passionate people can build when they're frustrated enough with bad engineering.

# The Poll

An 8 minute learning simulation for statistics, research methods and American government courses. Poll a stadium of 50,000 the night before a vote. Random samples of 100, 400 and 1,600 pile up on the field as sampling distributions. Then two large shortcut polls (a 6,400 name club list and a mail-in to all 50,000) report tiny margins and miss, as the Literary Digest did in 1936.

Live: https://josebowen.github.io/ThePoll/

## What is real
- Every poll is a real random draw from a fixed population (26,500 of 50,000 vote Yes). Nothing is scripted.
- The 1936 record and its check status are in `data/sources-verified.md`. The stadium, its split between decks and the reply rates are invented and labeled as illustrative in the About panel.

## Build and test
    npm install
    node build.mjs
    npm test          # puppeteer walkthrough and model check at 1600x900 and 390x844

One of the faculty workshop demos listed at https://weteachwithai.com/vibe-coding/

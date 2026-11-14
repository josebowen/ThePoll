export const SRC = {
  osGov: { t: 'OpenStax, American Government 3e, 6.2 How Is Public Opinion Measured?', u: 'https://openstax.org/books/american-government-3e/pages/6-2-how-is-public-opinion-measured' },
  osStat: { t: 'OpenStax, Introductory Statistics, 8.3 A Population Proportion', u: 'https://openstax.org/books/introductory-statistics/pages/8-3-a-population-proportion' },
  pewMoe: { t: 'Pew Research Center (2016), 5 key things to know about the margin of error in election polls', u: 'https://www.pewresearch.org/short-reads/2016/09/08/understanding-the-margin-of-error-in-election-polls/' },
  pewGuide: { t: 'Pew Research Center (2019), A Field Guide to Polling: Election 2020 Edition', u: 'https://www.pewresearch.org/methods/2019/11/19/a-field-guide-to-polling-election-2020-edition/' },
  lus: { t: 'Lusinchi (2012), "President" Landon and the 1936 Literary Digest Poll, Social Science History 36(1)', u: 'https://doi.org/10.1017/S014555320001035X' },
  lohr: { t: 'Lohr and Brick (2017), Roosevelt Predicted to Win: Revisiting the 1936 Literary Digest Poll, Statistics, Politics and Policy 8(1)', u: 'https://gwern.net/doc/statistics/bias/2017-lohr.pdf' },
  app: { t: 'The American Presidency Project, 1936 election results', u: 'https://www.presidency.ucsb.edu/statistics/elections/1936' },
};
SRC.squire = { t: 'Squire (1988), Why the 1936 Literary Digest Poll Failed, Public Opinion Quarterly 52(1), as summarized in Why Do Polls Fail? (arXiv 2107.14166)', u: 'https://arxiv.org/pdf/2107.14166' };
export const cite = (k) => `<a class="cite" href="${SRC[k].u}" target="_blank" rel="noopener">${SRC[k].t}</a>`;

export const LANES = [
  { k: 'r100', method: 'rand', n: 100, label: '100 random', col: [0.85, 0.68, 1.4], css: '#c9a8ff' },
  { k: 'r400', method: 'rand', n: 400, label: '400 random', col: [0.4, 0.78, 1.5], css: '#6cc3ff' },
  { k: 'r1600', method: 'rand', n: 1600, label: '1,600 random', col: [1.2, 1.2, 1.28], css: '#f1f2ff' },
  { k: 'club', method: 'club', n: 6400, label: 'Club list, 6,400', col: [1.5, 0.32, 0.95], css: '#ff5fc0' },
  { k: 'mail', method: 'mail', n: 0, label: 'Mail to all', col: [1.5, 0.5, 0.36], css: '#ff8a66' },
];
export const GUESS = ['About 1,000', 'About 10,000', 'About 25,000'];
export const Q1 = { opts: ['It is cut in half', 'It is cut to a quarter', 'It stays about the same'], vals: [0.5, 0.25, 1], hint: 'Hint: the margin goes as one over the square root of the sample size. What is the square root of 4?' };
export const Q2 = { opts: ['Yes is ahead. The whole range is above 50.', 'Too close to call. The range includes 50.', 'No is ahead. The whole range is below 50.'], hint: 'Hint: add and subtract the margin from the poll number. Where does 50 fall?' };
export const Q3 = { opts: ['A smaller margin, and it can still miss', 'A smaller margin, so it will be closer', 'A larger margin, since the list is narrow'], hint: 'Hint: the margin formula only knows the sample size. Does it know who is on the list?' };
export const KINDS = ['Sampling error', 'Coverage bias', 'Nonresponse bias'];
export const CLASSIFY = [
  { q: 'Two random polls of 400, taken the same night, come out 4 points apart.', ans: 0, ok: 'Sampling error. Random samples differ by chance. This is the only error a margin of error describes, and the only one a bigger sample shrinks.', no: 'Both polls gave every seat the same chance. Nothing is wrong with the list or with who answered. What is left?' },
  { q: 'A poll draws all 6,400 names from the club list.', ans: 1, ok: 'Coverage bias. The upper deck had no chance of being asked, and the upper deck votes differently. More names from the same list give the same wrong answer with more decimals.', no: 'Everyone who was called answered. The trouble started earlier, with who could be called at all.' },
  { q: 'Ballots go to every seat. One side mails them back far more often than the other.', ans: 2, ok: 'Nonresponse bias. Everyone was asked, so the list was fine. Those who answered differ from those who did not.', no: 'Every seat got a ballot, so nobody was left off the list. The trouble came after that.' },
];
export const FIELDS = [
  { h: 'Statistics', p: 'Each pile on the field is a sampling distribution. Its width is the standard error, which shrinks with the square root of n. The range on each poll is a 95 percent confidence interval for a proportion. About 95 in 100 such ranges catch the true value when the sample is random.', k: 'osStat' },
  { h: 'Political science', p: 'A reported margin of error covers sampling error only. With two options, the margin on the lead is about twice the margin on one side\'s share. Response rates for phone polls fell from 36 percent in 1997 to 6 percent in 2018.', k: 'pewMoe', k2: 'pewGuide' },
  { h: 'Psychology, sociology, public health, marketing', p: 'Every survey and every participant pool has a list it draws from and a share who answer. A study of 20,000 online volunteers is the mail-in poll from this stadium.', k: null },
];
export const ABOUT = `
<h2 id="aboutH">About this demo</h2>
<p>A short simulation for a research methods, statistics or American government course. One mission: poll a stadium of 50,000 before a vote, watch sample size shrink the margin of error, then watch two large polls miss.</p>
<h3>Learning objectives</h3>
<ul><li>Predict how sample size changes the margin of error.</li><li>Interpret a poll result with its margin of error.</li><li>Distinguish sampling error from coverage bias and nonresponse bias.</li></ul>
<h3>What is real</h3>
<ul><li>The sampling. Every poll draws real random seats from a fixed population of 50,000 with 26,500 Yes votes (53.0 percent). Nothing is scripted. Your piles, ranges and hit rates are computed from your own draws.</li>
<li>The margin of error shown is the standard 95 percent figure for a proportion: 1.96 times the square root of p(1 − p)/n. ${cite('osStat')}.</li>
<li>The 1936 record. The Literary Digest mailed about 10 million ballots and tallied 2,376,523 returns: Landon 1,293,669, Roosevelt 972,897. Roosevelt won 60.8 percent of the popular vote to Landon's 36.5 and carried 46 of 48 states. ${cite('lus')}; ${cite('squire')}; ${cite('app')}.</li></ul>
<h3>What is modeled</h3>
<ul><li>The stadium is invented. The lower bowl (the club list, 12,000 seats) is set to 41 percent Yes and the upper deck to 56.8 percent. In the mail-in poll Yes voters reply 18 percent of the time and No voters 31 percent, which gives a response rate near the Digest's 24 percent. These numbers are illustrative.</li>
<li>Published Digest percentages differ by source (54 to 57 percent for Landon) depending on whether minor candidates are counted. This page uses the ballot counts and the two-party share.</li></ul>
<h3>Contested history</h3>
<p>Why the Digest failed is disputed. The textbook account blames a list built from telephone books and car registrations. Squire (1988) found that the list and the low response both biased the result. Lusinchi (2012) argues that phone and car owners favored Roosevelt and that nonresponse did the damage. Lohr and Brick (2017) show what weighting could have recovered. This demo lets you run both failures and gives no verdict.</p>
<h3>Sources</h3>
<ul>${Object.keys(SRC).map((k) => `<li>${cite(k)}</li>`).join('')}</ul>
<p>Polling concepts were checked against American Government 3e by Glen Krutz and Sylvie Waskiewicz, OpenStax, and Introductory Statistics by Barbara Illowsky and Susan Dean, OpenStax, both licensed CC BY 4.0. Access for free at <a href="https://openstax.org/books/american-government-3e/pages/1-introduction" target="_blank" rel="noopener">openstax.org/books/american-government-3e</a> and <a href="https://openstax.org/books/introductory-statistics/pages/1-introduction" target="_blank" rel="noopener">openstax.org/books/introductory-statistics</a>. No OpenStax text or figures are reproduced.</p>
<p>Built with Claude as a workshop demo for faculty. No tracking. No data leaves this page.</p>`;

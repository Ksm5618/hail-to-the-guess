// More crises — markets, money, and the social-media presidency.
// Same format as cards.js. Price tags / economic effects live in econ.js.

module.exports = [
  {
    id: 'fed_chair', cat: 'Economy', title: 'Pick a Fed Chair',
    text: 'The Federal Reserve chair\'s term is up. Your pick will steer interest rates — and the economy — for four years. Wall Street is hanging on your choice.',
    adv: [['Treasury', 'Markets want continuity.'], ['Chief of Staff', 'A dove means cheap money before the election.']],
    options: [
      { label: 'An inflation hawk', desc: 'Tough on prices, rates stay high.', pc: 5, bill: true, fx: { eco: -3, tre: 2, base: 2 }, news: 'HAWK TAKES THE FED; MORTGAGE RATES CLIMB' },
      { label: 'A growth dove', desc: 'Low rates, hot economy.', pc: 5, bill: true, fx: { eco: 5, app: 2 }, sched: [['inflation', 5]], news: 'DOVISH FED CHAIR SENDS STOCKS SOARING' },
      { label: 'Reappoint the current chair', desc: 'Stability above all.', fx: { eco: 2, uni: 2 }, news: 'FED CHAIR REAPPOINTED; MARKETS SHRUG' },
    ],
  },
  {
    id: 'black_monday', cat: 'Economy', title: 'Black Monday',
    text: 'The Dow just lost 22% in a single day — the worst crash since 1987. Retirement accounts are evaporating and everyone is watching you.',
    adv: [['Treasury', 'Calm the markets before Asia opens.'], ['Fed Chair', 'We can cut rates tonight if you back us.']],
    options: [
      { label: 'Prime-time address', desc: '"The fundamentals are strong."', roll: { p: 0.5, stat: 'eco', ok: { fx: { eco: 6, app: 6 }, news: 'MARKETS REBOUND AFTER PRESIDENT\'S ADDRESS' }, bad: { fx: { eco: -4, app: -5 }, news: 'SPEECH FAILS TO STOP THE SLIDE' } }, news: 'PRESIDENT ADDRESSES SHAKEN NATION' },
      { label: 'Emergency stimulus', desc: 'Pump money into the economy.', pc: 10, bill: true, fx: { tre: -12, eco: 7, app: 4 }, news: 'EMERGENCY STIMULUS STEADIES WALL STREET' },
      { label: 'Let the market find its floor', desc: 'Crashes correct themselves.', fx: { eco: -6, base: 3, app: -4 }, news: 'WHITE HOUSE STAYS HANDS-OFF AS STOCKS SLIDE' },
    ],
  },
  {
    id: 'min_wage', cat: 'Economy', title: 'The $20 Minimum Wage',
    text: 'Fast-food workers in 40 cities are striking for a $20 federal minimum wage. Small businesses say it would kill them. It hasn\'t been raised in 15 years.',
    adv: [['Labor', '$7.25 is a poverty wage.'], ['Commerce', 'Rural diners can\'t pay city wages.']],
    options: [
      { label: '$20 nationwide', desc: 'Phase in over 3 years.', pc: 15, bill: true, fx: { app: 5, uni: 2, eco: -4, base: 1 }, news: '$20 MINIMUM WAGE SIGNED' },
      { label: '$15, indexed to inflation', desc: 'The compromise.', pc: 10, bill: true, fx: { app: 4, uni: 3, eco: -1 }, news: 'MINIMUM WAGE RISES TO $15' },
      { label: 'Leave it to the states', desc: 'Washington stays out.', fx: { base: 2, app: -3, eco: 1 }, news: 'NO FEDERAL WAGE HIKE, PRESIDENT SAYS' },
    ],
  },
  {
    id: 'social_security', cat: 'Economy', title: 'Social Security Runs Dry',
    text: 'The trustees report is out: the Social Security trust fund will be empty in 8 years, triggering automatic 23% benefit cuts for 70 million retirees.',
    adv: [['Treasury', 'Every year we wait makes the fix more painful.'], ['Chief of Staff', 'Seniors vote. Touch benefits and we\'re done.']],
    options: [
      { label: 'Lift the payroll tax cap', desc: 'High earners pay on all income.', pc: 15, bill: true, fx: { tre: 12, app: 4, eco: -2 }, news: 'SOCIAL SECURITY SAVED BY TAX ON TOP EARNERS' },
      { label: 'Raise the retirement age to 69', desc: 'Longer lives, longer careers.', pc: 15, bill: true, fx: { tre: 14, app: -8, uni: -3 }, news: 'RETIREMENT AGE RAISED; SENIORS FURIOUS' },
      { label: 'Kick the can', desc: 'Problem for the next president.', fx: { tre: -4, app: 1 }, news: 'SOCIAL SECURITY FIX DELAYED AGAIN' },
    ],
  },
  {
    id: 'grocery_revolt', cat: 'Economy', title: 'Grocery Price Revolt',
    text: 'Eggs are $9 a dozen. Beef is up 30%. Grocery chains just posted record profits, and #GreedFlation is the #1 trend in the country.',
    adv: [['Agriculture', 'Bird flu and drought are real causes.'], ['Chief of Staff', 'Voters want a villain. Give them one.']],
    options: [
      { label: 'Investigate price gouging', desc: 'Antitrust probe of food giants.', fx: { app: 5, eco: -1 }, roll: { p: 0.5, ok: { fx: { app: 3, eco: 2 }, news: 'FOOD GIANTS CUT PRICES UNDER PRESSURE' }, bad: { fx: { app: -2 }, news: 'GOUGING PROBE FINDS LITTLE; PRICES STAY HIGH' } }, news: 'FTC LAUNCHES GROCERY PRICE PROBE' },
      { label: 'Suspend food tariffs', desc: 'Cheaper imports, angry farmers.', fx: { app: 3, base: -3, eco: 2 }, news: 'FOOD TARIFFS SUSPENDED' },
      { label: 'Grocery rebate checks', desc: '$300 per household.', fx: { tre: -10, app: 6 }, news: '$300 GROCERY CHECKS IN THE MAIL' },
    ],
  },
  {
    id: 'ai_layoffs', cat: 'Tech', title: 'The AI Layoff Wave',
    text: 'In six months, AI has replaced 2 million call-center, legal and coding jobs. Profits are soaring. Unemployment lines are growing.',
    adv: [['Labor', 'This is the industrial revolution in fast-forward.'], ['Commerce', 'Tax the robots and the jobs move overseas.']],
    options: [
      { label: 'Universal basic income pilot', desc: '$1,000/month in 10 cities.', fx: { tre: -9, app: 5, uni: 4 }, news: 'UBI PILOT LAUNCHES IN 10 CITIES' },
      { label: 'Robot tax', desc: 'Tax companies per job automated.', pc: 10, bill: true, fx: { tre: 8, eco: -4, app: 4 }, news: 'FIRST-EVER ROBOT TAX PASSES' },
      { label: 'Massive retraining program', desc: 'Teach the displaced new skills.', fx: { tre: -6, eco: 3 }, roll: { p: 0.55, ok: { fx: { app: 5 }, news: 'RETRAINED WORKERS LAND NEW JOBS' }, bad: { fx: { app: -4 }, news: 'RETRAINING PROGRAM CALLED A FLOP' } }, news: 'RETRAINING BLITZ ANNOUNCED' },
    ],
  },
  {
    id: 'strait_standoff', cat: 'Foreign', title: 'Standoff in the Strait',
    text: 'A rival superpower has surrounded the island that makes 90% of the world\'s advanced chips with warships. It calls it a "drill." Nobody believes that.',
    adv: [['Defense', 'Two carrier groups would make them think twice.'], ['State', 'One wrong move and this becomes World War III.']],
    options: [
      { label: 'Send two carrier groups', desc: 'Show of force.', fx: { sec: 5, dip: -4 }, roll: { p: 0.65, stat: 'sec', ok: { fx: { sec: 6, app: 6 }, news: 'RIVAL FLEET WITHDRAWS AFTER U.S. SHOW OF FORCE' }, bad: { fx: { sec: -8, eco: -6, app: -6 }, news: 'WARSHIPS COLLIDE; GLOBAL MARKETS TUMBLE' } }, news: 'CARRIERS STEAM TOWARD THE STRAIT' },
      { label: 'Emergency diplomacy', desc: 'Hotline call to their leader.', fx: { dip: 4 }, roll: { p: 0.6, stat: 'dip', ok: { fx: { dip: 6, eco: 3, app: 4 }, news: 'LATE-NIGHT CALL DEFUSES STRAIT CRISIS' }, bad: { fx: { sec: -4, app: -4 }, news: 'DIPLOMACY FAILS; BLOCKADE TIGHTENS' } }, news: 'PRESIDENT CALLS RIVAL LEADER' },
      { label: 'Coordinated sanctions threat', desc: 'Rally allies to promise pain.', fx: { dip: 6, eco: -3, sec: 2 }, news: 'ALLIES WARN OF CRIPPLING SANCTIONS' },
    ],
  },
  {
    id: 'alliance_summit', cat: 'Foreign', title: 'The Alliance Summit',
    text: 'At the alliance summit, half the members still aren\'t spending their promised 2% of GDP on defense. Your voters ask why America pays for everyone.',
    adv: [['Defense', 'The alliance is our biggest strategic asset.'], ['Chief of Staff', '"Make them pay" polls through the roof.']],
    options: [
      { label: 'Pay up or we leave', desc: 'Threaten to pull out.', fx: { base: 6, dip: -8 }, roll: { p: 0.5, ok: { fx: { tre: 4, sec: 3 }, news: 'ALLIES PLEDGE BILLIONS AFTER U.S. ULTIMATUM' }, bad: { fx: { sec: -5, dip: -4 }, news: 'ALLIANCE IN CRISIS AFTER U.S. THREAT' } }, news: 'PRESIDENT ISSUES ALLIANCE ULTIMATUM' },
      { label: 'Reaffirm the alliance', desc: '"An attack on one is an attack on all."', fx: { dip: 7, sec: 4, base: -3 }, news: 'PRESIDENT REAFFIRMS ALLIANCE COMMITMENT' },
      { label: 'Quietly negotiate', desc: 'Private pressure, public smiles.', fx: { dip: 3, sec: 2 }, news: 'ALLIES AGREE TO SPENDING TARGETS' },
    ],
  },
  {
    id: 'grid_freeze', cat: 'Disaster', title: 'The Big Freeze',
    text: 'A polar vortex froze the Texas power grid. 4 million homes have no heat at -5°F. Pipes are bursting and people are dying.',
    adv: [['Energy', 'Their grid isn\'t connected to ours — that\'s the problem.'], ['FEMA', 'Generators and warming centers, now.']],
    options: [
      { label: 'Emergency aid + generators', desc: 'Military airlift.', fx: { tre: -6, app: 6, uni: 3 }, news: 'MILITARY AIRLIFTS GENERATORS TO TEXAS' },
      { label: 'Federal grid standards', desc: 'Never again.', pc: 10, bill: true, fx: { tre: -8, sec: 4, eco: 2, base: -2 }, news: 'NATIONAL GRID RESILIENCE ACT PASSES' },
      { label: 'It\'s a state issue', desc: 'Texas runs its own grid.', fx: { app: -6, uni: -4, base: 2 }, news: 'PRESIDENT: TEXAS GRID IS "THEIR CHOICE"' },
    ],
  },
  {
    id: 'hospital_ransomware', cat: 'Security', title: 'Hospitals Held Hostage',
    text: 'Ransomware has locked the systems of 300 hospitals. Surgeries are canceled and ambulances diverted. The hackers want $500 million in crypto.',
    adv: [['Cyber Command', 'We can try to take down their servers.'], ['HHS Secretary', 'Patients are dying while we debate.']],
    options: [
      { label: 'Cyber counterattack', desc: 'Hit the hackers\' infrastructure.', roll: { p: 0.55, stat: 'sec', ok: { fx: { sec: 7, app: 7 }, news: 'U.S. CYBER COMMAND CRIPPLES HACKER GANG' }, bad: { fx: { app: -7, sec: -4 }, news: 'COUNTERATTACK FAILS; MORE HOSPITALS HIT' } }, news: 'CYBER COMMAND STRIKES BACK' },
      { label: 'Pay the ransom', desc: 'Get the hospitals back online.', fx: { tre: -2, app: 2, sec: -5 }, news: 'GOVERNMENT PAYS HACKERS $500M' },
      { label: 'Mandatory cybersecurity law', desc: 'Federal standards for hospitals.', pc: 10, bill: true, fx: { sec: 6, tre: -4 }, news: 'HOSPITAL CYBER-SECURITY LAW SIGNED' },
    ],
  },
  {
    id: 'shutdown', cat: 'Domestic', title: 'Government Shutdown', needs: (s) => !s.congress,
    text: 'Congress refuses to pass a budget unless you scrap your signature program. At midnight, the government shuts down: 800,000 workers unpaid, parks closed, airports slowing.',
    adv: [['Chief of Staff', 'Whoever blinks first loses.'], ['Budget Director', 'Every week costs the economy $6 billion.']],
    options: [
      { label: 'Hold the line', desc: 'Make them own the shutdown.', fx: { base: 5 }, roll: { p: 0.5, stat: 'app', ok: { fx: { app: 5 }, news: 'CONGRESS CAVES AFTER 21-DAY SHUTDOWN' }, bad: { fx: { app: -8, eco: -4 }, news: 'LONGEST SHUTDOWN IN HISTORY; VOTERS BLAME PRESIDENT' } }, news: 'GOVERNMENT SHUTS DOWN' },
      { label: 'Cave', desc: 'Sign their budget.', fx: { base: -7, app: 2, tre: 4 }, news: 'PRESIDENT FOLDS TO END SHUTDOWN' },
      { label: 'Bipartisan grand bargain', desc: 'Everybody gives something.', pc: 15, fx: { uni: 7, app: 4, base: -2 }, news: 'RARE GRAND BARGAIN ENDS STANDOFF' },
    ],
  },

  // ============================================================ SOCIAL MEDIA
  {
    id: 'hot_mic', cat: 'Social', title: 'Hot Mic Moment',
    text: 'A microphone you thought was off caught you calling a swing state "a flyover wasteland." The clip has 40 million views on Chirp in three hours.',
    adv: [['Press Secretary', 'Apologize before the late-night shows get it.'], ['Campaign Manager', 'Own it — authenticity sells.']],
    options: [
      { label: 'Sincere apology video', desc: 'Post it on Chirp yourself.', roll: { p: 0.65, ok: { fx: { app: 2, uni: 2 }, news: 'PRESIDENT\'S APOLOGY "SURPRISINGLY HUMAN"' }, bad: { fx: { app: -4 }, news: 'APOLOGY VIDEO MOCKED AS FAKE' } }, news: 'PRESIDENT APOLOGIZES ON CHIRP' },
      { label: 'Double down', desc: '"I said what I said."', fx: { base: 5, app: -6, uni: -4 }, news: '"I SAID WHAT I SAID," PRESIDENT CHIRPS' },
      { label: 'Visit the state', desc: 'Diner tour, shake every hand.', fx: { app: 3, tre: -1 }, roll: { p: 0.55, ok: { fx: { app: 3 }, news: 'DINER TOUR WINS BACK SWING STATE' }, bad: { fx: { app: -3 }, news: 'HECKLERS GREET PRESIDENT ON DINER TOUR' } }, news: 'PRESIDENT HEADS TO THE HEARTLAND' },
    ],
  },
  {
    id: 'deepfake', cat: 'Social', title: 'The Deepfake',
    text: 'A shockingly realistic AI video shows you accepting a bribe. It\'s fake — but 60% of people who\'ve seen it believe it. It\'s trending #1.',
    adv: [['Press Secretary', 'Debunk it with forensic proof, fast.'], ['Attorney General', 'Find who made it and prosecute.']],
    options: [
      { label: 'Release forensic proof', desc: 'Show the world it\'s fake.', roll: { p: 0.6, ok: { fx: { app: 3, sec: 2 }, news: 'EXPERTS CONFIRM: PRESIDENT VIDEO IS FAKE' }, bad: { fx: { app: -6 }, news: 'MILLIONS STILL BELIEVE THE DEEPFAKE' } }, news: 'WHITE HOUSE: VIDEO IS AI FAKE' },
      { label: 'Force platforms to pull it', desc: 'Demand Chirp take it down.', fx: { app: -1, uni: -3 }, roll: { p: 0.5, ok: { fx: { app: 2 }, news: 'PLATFORMS REMOVE DEEPFAKE' }, bad: { fx: { app: -4, uni: -2 }, news: '"CENSORSHIP!" CRIES GROW AFTER TAKEDOWN DEMAND' } }, news: 'PRESIDENT DEMANDS DEEPFAKE TAKEDOWN' },
      { label: 'Ignore it', desc: 'Don\'t feed the trolls.', roll: { p: 0.4, ok: { fx: {}, news: 'DEEPFAKE STORY FIZZLES' }, bad: { fx: { app: -8 }, news: 'DEEPFAKE BRIBERY CLAIM HAUNTS PRESIDENT' } }, news: 'WHITE HOUSE SILENT ON VIRAL VIDEO' },
    ],
  },
  {
    id: 'podcast', cat: 'Social', title: 'The Podcast Invitation',
    text: 'The country\'s biggest podcaster — 50 million listeners, mostly young men who don\'t watch the news — invited you on for a three-hour unscripted interview.',
    adv: [['Campaign Manager', 'That audience decides elections now.'], ['Press Secretary', 'Three hours unscripted? Something WILL go wrong.']],
    options: [
      { label: 'Go on the show', desc: 'Three hours, no notes.', roll: { p: 0.55, ok: { fx: { app: 7, base: 3 }, news: 'PRESIDENT\'S PODCAST APPEARANCE BREAKS RECORDS' }, bad: { fx: { app: -6 }, news: 'PODCAST GAFFES GO VIRAL' } }, news: 'PRESIDENT SITS DOWN FOR 3-HOUR PODCAST' },
      { label: 'Send the Vice President', desc: 'Lower risk, lower reward.', fx: { app: 1 }, news: 'VICE PRESIDENT DOES THE PODCAST INSTEAD' },
      { label: 'Decline', desc: 'Presidents don\'t do podcasts.', fx: { app: -2, base: -1 }, news: 'PRESIDENT SNUBS TOP PODCASTER' },
    ],
  },
  {
    id: 'viral_challenge', cat: 'Social', title: 'Trending: #AskThePresident',
    text: 'Chirp is offering you a live, unfiltered #AskThePresident session. 10 million people are submitting questions — many of them hostile.',
    adv: [['Press Secretary', 'Pre-screen the questions.'], ['Digital Director', 'Unfiltered is the whole point. Go raw.']],
    options: [
      { label: 'Go fully unfiltered', desc: 'Answer anything.', roll: { p: 0.5, stat: 'uni', ok: { fx: { app: 7, uni: 3 }, news: 'UNFILTERED Q&A A MASSIVE HIT' }, bad: { fx: { app: -5 }, news: 'TROLLS HIJACK PRESIDENT\'S LIVE Q&A' } }, news: 'PRESIDENT GOES LIVE ON CHIRP' },
      { label: 'Pre-screened questions', desc: 'Safe and boring.', fx: { app: 1, uni: -1 }, news: '"STAGED" Q&A MOCKED ONLINE' },
      { label: 'Skip it', desc: 'Not worth the risk.', fx: {}, news: 'PRESIDENT PASSES ON CHIRP Q&A' },
    ],
  },
  {
    id: 'chirp_ban', cat: 'Social', title: 'Chirp Suspends a Senator',
    text: 'Chirp permanently banned a popular opposition senator for "misinformation." Half the country says it\'s censorship, half says it\'s overdue. Both sides want you to weigh in.',
    adv: [['Attorney General', 'Private companies can moderate their platforms.'], ['Chief of Staff', 'Stay out of it. Seriously.']],
    options: [
      { label: 'Defend free speech', desc: 'Demand the ban be reversed.', fx: { uni: 4, base: -2, app: 2 }, news: 'PRESIDENT DEFENDS RIVAL\'S RIGHT TO SPEAK' },
      { label: 'Back the platform', desc: 'Misinformation has consequences.', fx: { base: 3, uni: -5 }, news: 'PRESIDENT BACKS CHIRP BAN' },
      { label: 'Social media reform law', desc: 'Transparency rules for all platforms.', pc: 10, bill: true, fx: { uni: 3, sec: 2, app: 2 }, news: 'PLATFORM TRANSPARENCY ACT SIGNED' },
    ],
  },
];

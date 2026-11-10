// "Oval Office" crisis cards.
//
// Meter keys: eco (economy), sec (security), dip (diplomacy), env (environment),
// uni (national unity), tre (treasury / fiscal health), app (approval), base (your party's base).
//
// Option fields:
//   label, desc         what you do
//   fx                  meter changes applied immediately
//   pc                  political capital cost
//   bill                needs Congress to pass (odds drop sharply under divided government)
//   roll                { p, stat?, ok: {fx, news}, bad: {fx, news, sched?, flags?} } — a gamble
//   flags               remembered choices (drive later consequences)
//   sched               [[cardId, quartersFromNow], ...] follow-up crises
//   news                newspaper headline after the choice
//
// Cards may set `only: 'followup'` (never drawn at random), `term: 2` (second term only),
// or `needs: (s) => bool` (only drawn when the condition holds).

module.exports = [
  // ============================================================ HEALTH
  {
    id: 'pandemic', cat: 'Health', title: 'A Novel Virus',
    text: 'A fast-spreading respiratory virus has appeared in three cities. Hospitals in one are already at capacity. Scientists say the next two weeks decide everything.',
    adv: [['Surgeon General', 'Every day we wait doubles the cases.'], ['Treasury', 'A full shutdown could cost a trillion dollars.']],
    options: [
      { label: 'Nationwide lockdown', desc: 'Close non-essential business for 6 weeks.', pc: 10, fx: { eco: -14, uni: -6, app: 4, tre: -6, env: 2 }, flags: ['lockdown'], news: 'NATION SHUTS DOWN TO STOP VIRUS' },
      { label: 'Mass testing & targeted closures', desc: 'Test everyone, close only hot spots.', fx: { tre: -8, eco: -4 }, roll: { p: 0.55, ok: { fx: { app: 7, uni: 3, eco: 2 }, news: 'TEST-AND-TRACE BLITZ BENDS THE CURVE' }, bad: { fx: { app: -7, eco: -5 }, news: 'TESTING CAN\'T KEEP UP — CASES EXPLODE', sched: [['pandemic_wave', 2]] } }, news: 'PRESIDENT BETS ON TESTING' },
      { label: 'Keep the country open', desc: 'Urge calm, protect the economy.', fx: { eco: 3, base: 5, app: -2 }, flags: ['downplayed'], sched: [['pandemic_wave', 2]], news: '"NO NEED TO PANIC," SAYS PRESIDENT' },
    ],
  },
  {
    id: 'pandemic_wave', cat: 'Health', title: 'The Second Wave', only: 'followup',
    text: 'The virus is back and worse. ICU beds are full in 20 states, and a vaccine candidate is showing promise in early trials.',
    adv: [['HHS Secretary', 'With funding we could have doses in months, not years.'], ['Chief of Staff', 'People are exhausted. Another lockdown will be ugly.']],
    options: [
      { label: 'Emergency relief package', desc: 'Checks to families, loans to businesses.', pc: 15, bill: true, fx: { tre: -16, eco: 7, app: 6, uni: 3 }, news: '$2 TRILLION LIFELINE PASSES' },
      { label: 'Vaccine moonshot', desc: 'Pour money into rapid vaccine production.', fx: { tre: -10 }, roll: { p: 0.6, ok: { fx: { eco: 8, app: 10, uni: 5, dip: 4 }, news: 'VACCINE IN RECORD TIME — "A MIRACLE"' }, bad: { fx: { app: -8, uni: -4 }, news: 'VACCINE TRIAL FAILS; NATION REELS' } }, news: 'OPERATION LIGHTSPEED LAUNCHED' },
      { label: 'Let the states decide', desc: 'No federal mandates.', fx: { uni: -7, app: -4, base: 4, eco: -3 }, news: 'PATCHWORK RULES SPLIT THE COUNTRY' },
    ],
  },
  {
    id: 'insulin', cat: 'Health', title: 'Insulin Price Outrage',
    text: 'A viral video shows a diabetic teenager rationing insulin that costs $400 a vial. The drug companies blame middlemen. The country is furious.',
    adv: [['HHS Secretary', 'A price cap would save lives tomorrow.'], ['Commerce', 'Caps could chill drug research.']],
    options: [
      { label: 'Cap insulin at $35', desc: 'Federal price cap by law.', pc: 10, bill: true, fx: { app: 8, uni: 4, eco: -2, base: 2 }, news: '$35 INSULIN BECOMES LAW' },
      { label: 'Subsidize patients', desc: 'Government pays the difference.', fx: { tre: -8, app: 5 }, news: 'TAXPAYERS TO COVER INSULIN COSTS' },
      { label: 'Let the market fix it', desc: 'Fast-track generic competitors.', fx: { eco: 3 }, roll: { p: 0.45, ok: { fx: { app: 5 }, news: 'GENERICS SLASH INSULIN PRICES' }, bad: { fx: { app: -7, uni: -3 }, news: 'PRICES UNCHANGED; FAMILIES STILL RATIONING' } }, news: 'WHITE HOUSE PUSHES GENERIC INSULIN' },
    ],
  },
  {
    id: 'fentanyl', cat: 'Health', title: 'The Overdose Epidemic',
    text: 'Overdose deaths hit 110,000 last year. Small towns are burying a generation. Most of the supply is smuggled across the border.',
    adv: [['Drug Czar', 'Treatment works. Prisons haven\'t.'], ['Homeland Security', 'Choke the supply and the deaths fall.']],
    options: [
      { label: 'Treatment for all', desc: 'Fund addiction care nationwide.', fx: { tre: -9, app: 4, uni: 4 }, roll: { p: 0.6, ok: { fx: { app: 4, eco: 2 }, news: 'OVERDOSE DEATHS FALL FOR FIRST TIME IN DECADE' }, bad: { fx: { app: -3 }, news: 'TREATMENT CENTERS OVERWHELMED' } }, news: 'HISTORIC ADDICTION-CARE PLAN UNVEILED' },
      { label: 'Crack down on traffickers', desc: 'Designate cartels as terror groups.', fx: { sec: 6, base: 5, dip: -6 }, news: 'CARTELS LABELED TERRORISTS' },
      { label: 'Pressure source countries', desc: 'Tariffs until they act.', fx: { dip: -4, eco: -3 }, roll: { p: 0.5, ok: { fx: { sec: 5, app: 4 }, news: 'SUPPLIERS AGREE TO CRACKDOWN' }, bad: { fx: { dip: -4, app: -2 }, news: 'TARIFF THREAT BACKFIRES' } }, news: 'PRESIDENT THREATENS TARIFFS OVER DRUGS' },
    ],
  },

  // ============================================================ ECONOMY
  {
    id: 'bank_run', cat: 'Economy', title: 'Midnight Call from the Fed',
    text: 'Continental Meridian, the nation\'s 4th-largest bank, will not open Monday. Depositors are pulling $40 billion an hour. Markets open in 9 hours.',
    adv: [['Treasury', 'If it fails, three more go with it.'], ['Chief of Staff', 'Voters hate bailouts more than anything.']],
    options: [
      { label: 'Full bailout', desc: 'Guarantee everything. Stop the panic.', fx: { tre: -15, eco: 8, app: -7, base: -5, uni: -3 }, news: 'GOVERNMENT RESCUES MERIDIAN — AT A PRICE' },
      { label: 'Protect depositors only', desc: 'Savers safe, shareholders wiped out.', fx: { tre: -6, app: 3 }, roll: { p: 0.65, ok: { fx: { eco: 4, app: 4 }, news: 'PANIC CONTAINED; "SAVERS FIRST" PRAISED' }, bad: { fx: { eco: -8 }, news: 'TWO MORE BANKS WOBBLE', sched: [['contagion', 1]] } }, news: 'DEPOSITORS PROTECTED, BANKERS NOT' },
      { label: 'Let it fail', desc: 'No more bailouts. Markets must learn.', fx: { eco: -12, base: 5 }, flags: ['let_bank_fail'], sched: [['contagion', 1]], news: 'MERIDIAN COLLAPSES; DOW PLUNGES 2,000' },
    ],
  },
  {
    id: 'contagion', cat: 'Economy', title: 'Contagion', only: 'followup',
    text: 'The banking panic is spreading. Regional banks are failing. Credit has frozen, and small businesses can\'t make payroll.',
    adv: [['Fed Chair', 'We need a backstop, today.'], ['Labor', 'Main Street is drowning.']],
    options: [
      { label: 'Emergency credit facility', desc: 'Unlimited lending to banks.', fx: { tre: -12, eco: 9, app: -2 }, news: 'FED AND TREASURY FLOOD SYSTEM WITH CASH' },
      { label: 'Small-business rescue', desc: 'Direct grants to Main Street.', pc: 10, bill: true, fx: { tre: -10, eco: 5, app: 6, uni: 3 }, news: 'MAIN STREET RESCUE PASSES' },
      { label: 'Ride it out', desc: 'Recessions end.', fx: { eco: -10, app: -8, uni: -4 }, flags: ['recession'], news: 'NATION SLIDES INTO RECESSION' },
    ],
  },
  {
    id: 'inflation', cat: 'Economy', title: 'Inflation Hits 9%',
    text: 'Groceries are up 15% in a year. Rent is up 20%. Every poll says prices are the #1 issue, and the Fed is waiting on you.',
    adv: [['Treasury', 'Cut spending and the fire goes out.'], ['Chief of Staff', 'Price gouging stories poll great.']],
    options: [
      { label: 'Spending cuts', desc: 'Slash federal spending 8%.', fx: { tre: 10, eco: -4, app: -6, base: 3 }, news: 'BELT-TIGHTENING BUDGET ANNOUNCED' },
      { label: 'Price controls', desc: 'Cap prices on food and fuel.', fx: { app: 5 }, roll: { p: 0.35, ok: { fx: { eco: 2, app: 3 }, news: 'PRICE CAPS HOLD — FOR NOW' }, bad: { fx: { eco: -9, app: -4 }, news: 'SHORTAGES SPREAD AFTER PRICE CAPS' } }, news: 'PRESIDENT ORDERS PRICE CAPS' },
      { label: 'Back the Fed\'s rate hikes', desc: 'Short-term pain, long-term cure.', fx: { eco: -5, app: -3 }, sched: [['soft_landing', 3]], news: 'RATES SOAR; PRESIDENT: "IT WILL BE WORTH IT"' },
    ],
  },
  {
    id: 'soft_landing', cat: 'Economy', title: 'The Landing', only: 'followup',
    text: 'A year of high interest rates later, inflation is falling. Will the economy land softly or crash?',
    adv: [['Fed Chair', 'We\'re threading a needle.'], ['Treasury', 'Some stimulus now could guarantee it.']],
    options: [
      { label: 'Stay the course', desc: 'Trust the plan.', roll: { p: 0.6, stat: 'eco', ok: { fx: { eco: 10, app: 8 }, news: 'SOFT LANDING! INFLATION BEATEN, JOBS INTACT' }, bad: { fx: { eco: -8, app: -6 }, news: 'MILD RECESSION AS RATES BITE' } }, news: 'WHITE HOUSE HOLDS STEADY' },
      { label: 'Targeted stimulus', desc: 'Help the hardest hit.', fx: { tre: -6, eco: 4, app: 3 }, news: 'TARGETED RELIEF CUSHIONS SLOWDOWN' },
    ],
  },
  {
    id: 'trade_war', cat: 'Economy', title: 'Tariff Showdown',
    text: 'Your largest trading rival slapped 25% tariffs on American soybeans and cars overnight. Farmers are panicking, and the rival says it\'s "your move."',
    adv: [['Trade Rep', 'If we blink, they\'ll do it again.'], ['Agriculture', 'Farms will go under by harvest.']],
    options: [
      { label: 'Hit back hard', desc: 'Matching tariffs on everything.', fx: { base: 6, eco: -6, dip: -6 }, roll: { p: 0.45, ok: { fx: { eco: 9, app: 6 }, news: 'RIVAL BLINKS; TARIFFS LIFTED' }, bad: { fx: { eco: -6, app: -4 }, news: 'TRADE WAR DRAGS ON; PRICES CLIMB' } }, news: 'PRESIDENT FIRES BACK WITH TARIFFS' },
      { label: 'Negotiate', desc: 'Quiet talks for a deal.', pc: 5, fx: { dip: 6, eco: -2, base: -4 }, news: 'TRADE TALKS BEGIN IN GENEVA' },
      { label: 'Bail out farmers', desc: 'Subsidies, no escalation.', fx: { tre: -8, base: 3, eco: -1 }, news: '$30 BILLION FOR FARMERS' },
    ],
  },
  {
    id: 'rail_strike', cat: 'Economy', title: 'Nationwide Rail Strike',
    text: '120,000 rail workers walk off the job over sick days. Freight has stopped. Factories have three days of parts left.',
    adv: [['Labor', 'They\'re asking for sick days. Sick days.'], ['Commerce', 'Every day costs $2 billion.']],
    options: [
      { label: 'Force a deal by law', desc: 'Congress imposes a contract.', pc: 10, bill: true, fx: { eco: 5, uni: -4, app: -2 }, news: 'CONGRESS ENDS RAIL STRIKE; UNIONS FUME' },
      { label: 'Side with the workers', desc: 'Pressure railroads to give in.', fx: { uni: 4, eco: -4, app: 4 }, news: 'RAILROADS CAVE; WORKERS WIN SICK DAYS' },
      { label: 'Wait it out', desc: 'Let both sides sweat.', fx: { eco: -9, app: -5 }, news: 'SHELVES EMPTY AS STRIKE ENTERS WEEK 3' },
    ],
  },
  {
    id: 'oil_shock', cat: 'Economy', title: 'Oil Hits $160',
    text: 'A war overseas has knocked out a fifth of the world\'s oil. Gas is $7 a gallon. Truckers are threatening to block highways.',
    adv: [['Energy', 'The strategic reserve exists for exactly this.'], ['Climate Envoy', 'This is the moment to end our addiction.']],
    options: [
      { label: 'Tap the reserve + gas tax holiday', desc: 'Fast relief at the pump.', fx: { tre: -8, app: 6, eco: 3, env: -2 }, news: 'GAS PRICES DIP AFTER RESERVE RELEASE' },
      { label: 'Drill, baby, drill', desc: 'Open federal land and waters.', fx: { eco: 6, env: -10, base: 4, uni: -2 }, news: 'MASSIVE DRILLING EXPANSION APPROVED' },
      { label: 'Go electric, fast', desc: 'Huge EV and transit incentives.', pc: 10, fx: { env: 10, tre: -10, eco: -2, app: -2 }, sched: [['green_boom', 4]], news: 'PRESIDENT: "THE OIL AGE IS ENDING"' },
    ],
  },
  {
    id: 'green_boom', cat: 'Economy', title: 'The Green Boom', only: 'followup',
    text: 'Your clean energy bet is paying off: battery factories are opening across the Midwest. Oil states are furious and want the subsidies cut.',
    adv: [['Energy', 'We\'re winning the industry of the century.']],
    options: [
      { label: 'Double down', desc: 'Expand the incentives.', fx: { eco: 7, env: 6, tre: -5, app: 4 }, news: 'BATTERY BELT BOOMS' },
      { label: 'Share the wealth', desc: 'Retrain oil workers for new jobs.', fx: { eco: 5, uni: 5, tre: -4 }, news: 'OIL WORKERS RETRAINED FOR GREEN JOBS' },
    ],
  },
  {
    id: 'taxes', cat: 'Economy', title: 'The Tax Question',
    text: 'Your budget is due. The deficit is ballooning, the middle class feels squeezed, and billionaires\' wealth doubled in five years.',
    adv: [['Treasury', 'We can\'t keep borrowing like this.'], ['Chief of Staff', 'Whatever we do, don\'t touch the middle class.']],
    options: [
      { label: 'Cut taxes for everyone', desc: 'Growth will pay for it. Maybe.', pc: 10, bill: true, fx: { tre: -12, eco: 6, base: 6, uni: -2 }, news: 'SWEEPING TAX CUTS SIGNED' },
      { label: 'Tax the ultra-rich', desc: 'New billionaire minimum tax.', pc: 15, bill: true, fx: { tre: 12, app: 4, eco: -2 }, news: 'BILLIONAIRE TAX BECOMES LAW' },
      { label: 'Simplify the code', desc: 'File taxes on a postcard.', pc: 15, bill: true, fx: { eco: 4, app: 5, uni: 3, tre: -2 }, news: 'TAX FORMS SHRINK TO ONE PAGE' },
    ],
  },
  {
    id: 'big_tech', cat: 'Economy', title: 'Breaking Up Big Tech',
    text: 'Four companies now control search, phones, social media and online shopping. Small businesses say they\'re being crushed. Investors say these are America\'s crown jewels.',
    adv: [['Attorney General', 'It\'s a monopoly case we can win.'], ['Commerce', 'Our rivals would love it if we kneecapped our champions.']],
    options: [
      { label: 'Break them up', desc: 'Antitrust suits on all four.', pc: 10, fx: { eco: -5, app: 6, uni: 3 }, roll: { p: 0.5, ok: { fx: { eco: 6 }, news: 'COURT ORDERS BREAKUP; STARTUPS SURGE' }, bad: { fx: { app: -4 }, news: 'JUDGE TOSSES ANTITRUST CASE' } }, news: 'GOVERNMENT SUES BIG TECH' },
      { label: 'Regulate, don\'t break', desc: 'Privacy & fair-competition rules.', pc: 5, bill: true, fx: { app: 3, uni: 2 }, news: 'NEW DIGITAL RULES PASS' },
      { label: 'Hands off', desc: 'Champions stay champions.', fx: { eco: 5, app: -3 }, news: 'WHITE HOUSE BACKS BIG TECH' },
    ],
  },
  {
    id: 'housing', cat: 'Economy', title: 'The Rent Is Too Damn High',
    text: 'Median rent now eats 40% of a paycheck. Young people can\'t afford homes, and tent cities are spreading.',
    adv: [['HUD Secretary', 'We simply haven\'t built enough homes.'], ['Chief of Staff', 'Rent caps are popular. Really popular.']],
    options: [
      { label: 'Build 3 million homes', desc: 'Federal construction blitz.', pc: 10, bill: true, fx: { tre: -10, eco: 5, app: 5, uni: 3 }, news: 'HOUSING BLITZ: 3 MILLION HOMES' },
      { label: 'National rent caps', desc: 'Limit increases to 3% a year.', fx: { app: 6, eco: -4 }, sched: [['rent_fallout', 4]], news: 'RENT CAPPED NATIONWIDE' },
      { label: 'Kill zoning rules', desc: 'Tie funds to local reforms.', fx: { eco: 3, base: -3 }, roll: { p: 0.55, ok: { fx: { eco: 4, app: 5 }, news: 'BUILDING BOOM AS ZONING FALLS' }, bad: { fx: { uni: -4 }, news: 'SUBURBS REVOLT AGAINST ZONING PUSH' } }, news: 'WAR ON ZONING DECLARED' },
    ],
  },
  {
    id: 'rent_fallout', cat: 'Economy', title: 'Landlords Strike Back', only: 'followup',
    text: 'Your rent caps worked at first, but builders have stopped building. Housing supply is drying up.',
    adv: [['HUD Secretary', 'Pair caps with construction incentives.']],
    options: [
      { label: 'Add building incentives', desc: 'Tax breaks for new housing.', fx: { tre: -6, eco: 4 }, news: 'BUILDERS LURED BACK WITH TAX BREAKS' },
      { label: 'Repeal the caps', desc: 'Admit it didn\'t work.', fx: { app: -5, eco: 4, base: -2 }, news: 'PRESIDENT REVERSES RENT CAPS' },
    ],
  },
  {
    id: 'crypto', cat: 'Economy', title: 'Crypto Crash',
    text: 'The country\'s biggest crypto exchange just collapsed, taking $60 billion of ordinary people\'s savings with it. The founder fled the country.',
    adv: [['Treasury', 'Not our job to bail out gamblers.'], ['Chief of Staff', 'Twelve million voters just lost money.']],
    options: [
      { label: 'Regulate crypto like banks', desc: 'Strict rules, licensed exchanges.', pc: 5, bill: true, fx: { sec: 3, eco: -2, app: 3 }, news: 'CRYPTO WILD WEST ENDS' },
      { label: 'Extradite the founder', desc: 'Make an example.', fx: { dip: -2 }, roll: { p: 0.6, ok: { fx: { app: 6 }, news: 'CRYPTO KING EXTRADITED IN HANDCUFFS' }, bad: { fx: { app: -3 }, news: 'FUGITIVE FOUNDER STILL ON THE LOOSE' } }, news: 'MANHUNT FOR CRYPTO FOUNDER' },
      { label: 'Embrace crypto', desc: 'Make the U.S. the crypto capital.', fx: { eco: 3, base: 2, app: -3 }, news: 'PRESIDENT DOUBLES DOWN ON CRYPTO' },
    ],
  },
  {
    id: 'chips', cat: 'Economy', title: 'Empty Shelves',
    text: 'A chip shortage has stalled car factories and electronics makers. 90% of advanced chips come from one island across the world.',
    adv: [['Commerce', 'We need fabs on American soil.'], ['Defense', 'This is a national security emergency.']],
    options: [
      { label: 'Build chip fabs at home', desc: '$50B to bring production back.', pc: 10, bill: true, fx: { tre: -10, sec: 4 }, sched: [['chip_boom', 4]], news: 'CHIPS ACT: FACTORIES COMING HOME' },
      { label: 'Lean on allies', desc: 'Secure supply deals abroad.', fx: { dip: 5, eco: 2 }, news: 'ALLIES PLEDGE CHIP SUPPLY' },
      { label: 'Let the market adjust', desc: 'Shortages end eventually.', fx: { eco: -6, app: -3 }, news: 'CAR PRICES SOAR AMID SHORTAGE' },
    ],
  },
  {
    id: 'chip_boom', cat: 'Economy', title: 'Silicon Heartland', only: 'followup',
    text: 'The first American mega-fab just opened in Ohio. 30,000 jobs, and the world\'s most advanced chips — made in the USA.',
    adv: [['Commerce', 'Take a victory lap, sir.']],
    options: [
      { label: 'Ribbon-cutting rally', desc: 'Celebrate the jobs.', fx: { eco: 8, sec: 4, app: 6 }, news: '"MADE IN AMERICA" CHIPS ROLL OUT' },
      { label: 'Expand to 10 more states', desc: 'Spread the boom.', fx: { eco: 10, tre: -6, uni: 4 }, news: 'CHIP FACTORIES FOR 10 STATES' },
    ],
  },
  {
    id: 'infrastructure', cat: 'Economy', title: 'Bridges Are Falling',
    text: 'A highway bridge collapsed at rush hour, killing 13. Engineers say 45,000 bridges are "structurally deficient."',
    adv: [['Transportation', 'This is a once-in-a-generation fix.'], ['Treasury', 'It\'ll cost a trillion.']],
    options: [
      { label: 'Trillion-dollar rebuild', desc: 'Roads, bridges, broadband, water.', pc: 20, bill: true, fx: { tre: -15, eco: 7, app: 7, uni: 4 }, news: 'HISTORIC INFRASTRUCTURE BILL SIGNED' },
      { label: 'Private partnerships', desc: 'Let investors build, charge tolls.', fx: { eco: 4, app: -2, tre: -3 }, news: 'TOLL ROADS COMING TO A HIGHWAY NEAR YOU' },
      { label: 'Emergency repairs only', desc: 'Fix the worst bridges.', fx: { tre: -4, app: -2 }, news: 'BAND-AID FIX FOR CRUMBLING BRIDGES' },
    ],
  },
  {
    id: 'student_debt', cat: 'Economy', title: 'The $1.7 Trillion Question',
    text: '45 million Americans owe student loans. Payments are about to restart, and young voters say cancel it or lose them.',
    adv: [['Education', 'Cancel some, then fix college costs.'], ['Treasury', 'Full cancellation is a fiscal grenade.']],
    options: [
      { label: 'Cancel it all', desc: 'Wipe out every student loan.', fx: { tre: -16, app: 4, uni: -4, base: 3 }, roll: { p: 0.4, ok: { fx: { app: 5, eco: 3 }, news: 'COURTS UPHOLD DEBT CANCELLATION' }, bad: { fx: { app: -6 }, news: 'SUPREME COURT BLOCKS DEBT CANCELLATION' } }, news: 'PRESIDENT CANCELS STUDENT DEBT' },
      { label: 'Cancel $10k + cap tuition', desc: 'Partial relief and reform.', pc: 10, bill: true, fx: { tre: -7, app: 4, uni: 2 }, news: 'PARTIAL DEBT RELIEF AND TUITION CAPS' },
      { label: 'Restart payments', desc: 'A loan is a loan.', fx: { tre: 3, app: -4, base: 2 }, news: 'STUDENT LOAN PAYMENTS RESUME' },
    ],
  },

  // ============================================================ SECURITY
  {
    id: 'hostages', cat: 'Security', title: 'Embassy Seized',
    text: 'Militants stormed our embassy overnight. 41 Americans are hostages. They want prisoners released within 72 hours.',
    adv: [['Defense', 'Delta Force is wheels-up on your word.'], ['State', 'A raid could get them all killed.']],
    options: [
      { label: 'Special forces rescue', desc: 'Go in at night.', roll: { p: 0.5, stat: 'sec', ok: { fx: { sec: 10, app: 14, dip: -3 }, news: 'ALL 41 HOSTAGES RESCUED IN DARING RAID' }, bad: { fx: { app: -16, sec: -6, dip: -5 }, news: 'RESCUE MISSION ENDS IN DISASTER' } }, news: 'RAID LAUNCHED' },
      { label: 'Negotiate through allies', desc: 'Back channels, patience.', fx: { dip: 5 }, roll: { p: 0.7, stat: 'dip', ok: { fx: { app: 6 }, news: 'HOSTAGES FREED AFTER SECRET TALKS' }, bad: { fx: { app: -7, sec: -3 }, news: 'TALKS STALL; HOSTAGES ENTER DAY 100' } }, news: 'QUIET DIPLOMACY BEGINS' },
      { label: 'Pay the ransom secretly', desc: 'Get them home. Don\'t ask how.', fx: { tre: -4, app: 5 }, flags: ['ransom'], sched: [['ransom_leak', 3]], news: 'HOSTAGES MYSTERIOUSLY RELEASED' },
    ],
  },
  {
    id: 'ransom_leak', cat: 'Scandal', title: 'The Ransom Leak', only: 'followup',
    text: 'A newspaper has proof you paid $400 million in cash to free the hostages. Critics say you funded terrorism.',
    adv: [['Press Secretary', 'Own it: you saved 41 lives.'], ['White House Counsel', 'Say nothing until we see the documents.']],
    options: [
      { label: 'Own it', desc: '"I\'d do it again."', fx: { app: -3, base: 2, uni: -2 }, news: '"I\'D DO IT AGAIN," PRESIDENT DECLARES' },
      { label: 'Deny everything', desc: 'Call it fake news.', fx: { app: -6, base: 4 }, flags: ['coverup'], sched: [['investigation', 2]], news: 'PRESIDENT DENIES RANSOM REPORT' },
    ],
  },
  {
    id: 'cyber', cat: 'Security', title: 'The Grid Goes Dark',
    text: 'Hackers shut down the power grid in four states. 20 million people have no power in a heat wave. Intelligence points to a hostile foreign government.',
    adv: [['Cyber Command', 'We can black out their capital in an hour.'], ['State', 'Retaliation could start a cyber war we can\'t control.']],
    options: [
      { label: 'Strike back', desc: 'Retaliatory cyberattack.', fx: { sec: 5, dip: -6, base: 4 }, roll: { p: 0.6, stat: 'sec', ok: { fx: { sec: 6, app: 6 }, news: 'U.S. CYBER STRIKE: "MESSAGE RECEIVED"' }, bad: { fx: { eco: -6, sec: -6 }, news: 'CYBER WAR ESCALATES; BANKS HIT' } }, news: 'PRESIDENT ORDERS CYBER RETALIATION' },
      { label: 'Sanctions & coalition', desc: 'Rally allies, punish them economically.', fx: { dip: 6, eco: -3, sec: 3 }, news: 'ALLIES UNITE ON CYBER SANCTIONS' },
      { label: 'Harden quietly', desc: 'Fix our systems; no public blame.', fx: { tre: -8, sec: 5, app: -4, base: -4 }, news: 'WHITE HOUSE SILENT ON BLACKOUT CULPRIT' },
    ],
  },
  {
    id: 'missile_test', cat: 'Security', title: 'Missile Over the Ocean',
    text: 'A rogue nuclear state just tested a missile that can reach Chicago. Its leader is daring you to respond.',
    adv: [['Defense', 'Show strength or they\'ll test again.'], ['State', 'He wants attention. Give him a summit and a deal.']],
    options: [
      { label: 'Summit with the dictator', desc: 'Face-to-face, high stakes.', fx: { dip: 4, base: -3 }, roll: { p: 0.4, stat: 'dip', ok: { fx: { sec: 10, app: 8, dip: 6 }, news: 'HISTORIC NUCLEAR DEAL SIGNED' }, bad: { fx: { app: -6, dip: -3 }, news: 'SUMMIT COLLAPSES; DICTATOR GLOATS' } }, news: 'PRESIDENT TO MEET DICTATOR' },
      { label: 'Naval blockade', desc: 'Ships surround their ports.', fx: { sec: 6, dip: -5 }, roll: { p: 0.75, stat: 'sec', ok: { fx: { app: 5 }, news: 'BLOCKADE WORKS; TESTS HALTED' }, bad: { fx: { sec: -8, app: -8, eco: -4 }, news: 'WARSHIPS EXCHANGE FIRE; WORLD HOLDS BREATH' } }, news: 'NAVY BLOCKADES ROGUE STATE' },
      { label: 'Quiet sanctions', desc: 'Squeeze them without drama.', fx: { dip: 2, sec: 1, base: -2 }, news: 'NEW SANCTIONS, LITTLE FANFARE' },
    ],
  },
  {
    id: 'border', cat: 'Security', title: 'Border Surge',
    text: 'A record 250,000 migrants arrived at the southern border this month, many fleeing collapse in their home country. Border towns are overwhelmed.',
    adv: [['Homeland Security', 'We need control of the border, now.'], ['State', 'Most are families. The world is watching.']],
    options: [
      { label: 'Militarize the border', desc: 'Troops and emergency closure.', fx: { sec: 6, base: 6, uni: -7, dip: -4 }, news: 'TROOPS SENT TO BORDER' },
      { label: 'Expand processing & aid', desc: 'More judges, shelters, order.', fx: { tre: -8, uni: 3, base: -5, app: 1 }, news: 'BORDER PROCESSING MASSIVELY EXPANDED' },
      { label: 'Comprehensive reform bill', desc: 'Security + legal pathways.', pc: 20, bill: true, fx: { uni: 7, eco: 4, app: 6, sec: 3 }, news: 'GRAND IMMIGRATION BARGAIN PASSES' },
    ],
  },
  {
    id: 'ally_invaded', cat: 'Foreign', title: 'An Ally Is Invaded',
    text: 'A neighboring superpower\'s tanks just crossed into a democratic ally. Its president is begging for help on live TV.',
    adv: [['Defense', 'If we don\'t stop it here, we fight later.'], ['Chief of Staff', 'Voters don\'t want another forever war.']],
    options: [
      { label: 'Weapons + sanctions', desc: 'Arm them, crush the aggressor\'s economy.', fx: { tre: -8, dip: 8, sec: 4, eco: -3 }, flags: ['armed_ally'], news: 'U.S. ARMS ALLY, SANCTIONS INVADER' },
      { label: 'Send troops', desc: 'Defend the ally directly.', fx: { tre: -10 }, roll: { p: 0.5, stat: 'sec', ok: { fx: { sec: 10, dip: 10, app: 8 }, news: 'INVASION REPELLED; ALLIES CHEER' }, bad: { fx: { sec: -8, app: -12, uni: -6 }, news: 'U.S. TROOPS KILLED; WAR WIDENS' } }, news: 'AMERICAN TROOPS DEPLOYED' },
      { label: 'Stay neutral', desc: 'Not our war.', fx: { dip: -12, eco: 2, base: 3, app: -3 }, news: 'U.S. STAYS OUT; ALLIES STUNNED' },
    ],
  },
  {
    id: 'coup', cat: 'Foreign', title: 'Coup in an Oil Nation',
    text: 'Generals have overthrown the elected government of a major oil producer. They promise to keep oil flowing — if you recognize them.',
    adv: [['Energy', 'Stable oil is stable prices.'], ['State', 'Recognizing a junta tells every dictator coups are fine.']],
    options: [
      { label: 'Recognize the junta', desc: 'Oil first.', fx: { eco: 4, dip: -6, uni: -2 }, news: 'U.S. RECOGNIZES COUP LEADERS' },
      { label: 'Demand democracy', desc: 'Sanctions until elections.', fx: { dip: 5, eco: -4 }, roll: { p: 0.45, ok: { fx: { dip: 6, app: 4 }, news: 'JUNTA AGREES TO ELECTIONS' }, bad: { fx: { eco: -3 }, news: 'JUNTA DIGS IN; OIL PRICES RISE' } }, news: 'PRESIDENT DEMANDS RETURN TO DEMOCRACY' },
      { label: 'Covertly back the opposition', desc: 'Let the CIA handle it.', roll: { p: 0.5, ok: { fx: { dip: 4, sec: 3 }, news: 'JUNTA FALLS; ELECTIONS CALLED' }, bad: { fx: { dip: -8, app: -6 }, flags: ['cia_exposed'], news: 'CIA PLOT EXPOSED; WORLD OUTRAGED' } }, news: 'WHITE HOUSE "MONITORING SITUATION"' },
    ],
  },
  {
    id: 'election_hack', cat: 'Security', title: 'Foreign Hackers Target Ballots',
    text: 'Intelligence confirms a foreign power is hacking voter rolls and flooding social media with fake videos ahead of the elections.',
    adv: [['FBI Director', 'We can stop the hacks. The disinformation is harder.'], ['Chief of Staff', 'Any move looks political right before an election.']],
    options: [
      { label: 'Go public, bipartisan', desc: 'Joint address with opposition leaders.', fx: { uni: 7, sec: 4, base: -2 }, news: 'RARE UNITY AGAINST FOREIGN MEDDLING' },
      { label: 'Expel diplomats + sanctions', desc: 'Make them pay.', fx: { sec: 5, dip: -4, base: 3 }, news: '35 DIPLOMATS EXPELLED' },
      { label: 'Handle it quietly', desc: 'Avoid panic.', roll: { p: 0.5, ok: { fx: { sec: 5 }, news: 'ELECTION PASSES WITHOUT INCIDENT' }, bad: { fx: { uni: -8, app: -6 }, news: 'HACK DISCOVERED; "WHY DIDN\'T THEY TELL US?"' } }, news: 'OFFICIALS SAY ELECTIONS ARE SECURE' },
    ],
  },
  {
    id: 'surveillance', cat: 'Security', title: 'The Surveillance Leak',
    text: 'A contractor leaked proof that intelligence agencies have been collecting every American\'s phone records. He\'s hiding abroad.',
    adv: [['NSA Director', 'This program has stopped attacks.'], ['Attorney General', 'Courts may rule it unconstitutional anyway.']],
    options: [
      { label: 'Shut it down', desc: 'End mass collection.', fx: { sec: -6, uni: 5, app: 4 }, news: 'MASS SURVEILLANCE ENDED' },
      { label: 'Defend it', desc: '"It keeps you safe."', fx: { sec: 5, app: -6, uni: -3 }, news: 'PRESIDENT DEFENDS SPYING PROGRAM' },
      { label: 'Reform with oversight', desc: 'Warrants and a privacy court.', pc: 10, bill: true, fx: { sec: 2, uni: 3, app: 3 }, news: 'SURVEILLANCE REFORM PASSES' },
    ],
  },
  {
    id: 'terror_plot', cat: 'Security', title: 'Credible Threat',
    text: 'The FBI says a terror cell plans to attack a major city within 48 hours. They don\'t know which one.',
    adv: [['FBI Director', 'Raise the alert. Better safe.'], ['Homeland Security', 'If we panic people, they\'ve already won.']],
    options: [
      { label: 'Public alert', desc: 'Warn everyone, flood cities with police.', fx: { eco: -4, sec: 4 }, roll: { p: 0.7, stat: 'sec', ok: { fx: { app: 6, sec: 4 }, news: 'PLOT FOILED AS CELL ARRESTED' }, bad: { fx: { app: -8, uni: 4 }, news: 'ATTACK STRIKES DESPITE ALERT' } }, news: 'NATIONAL TERROR ALERT RAISED' },
      { label: 'Quiet manhunt', desc: 'No panic; hunt them in secret.', roll: { p: 0.6, stat: 'sec', ok: { fx: { sec: 8, app: 5 }, news: 'FBI QUIETLY STOPS ATTACK' }, bad: { fx: { app: -14, sec: -8, uni: 4 }, news: 'ATTACK HITS CITY; "WHY NO WARNING?"' } }, news: 'FBI ON HIGH ALERT' },
    ],
  },
  {
    id: 'app_ban', cat: 'Security', title: 'The App Ban',
    text: 'A hugely popular video app owned by a rival nation may be feeding user data to its government. 150 million Americans use it daily.',
    adv: [['Defense', 'It\'s a spy tool in every pocket.'], ['Chief of Staff', 'Ban it and you lose every voter under 30.']],
    options: [
      { label: 'Ban it', desc: 'Off app stores in 30 days.', fx: { sec: 6, app: -6, dip: -3 }, news: 'POPULAR APP BANNED; TEENS DEVASTATED' },
      { label: 'Force a sale', desc: 'Must be sold to a U.S. company.', fx: { sec: 4, dip: -4 }, roll: { p: 0.55, ok: { fx: { app: 3 }, news: 'APP SOLD TO AMERICAN BUYER' }, bad: { fx: { app: -3 }, news: 'SALE TALKS COLLAPSE' } }, news: 'SELL OR BE BANNED, APP TOLD' },
      { label: 'Leave it alone', desc: 'Not worth the fight.', fx: { sec: -5, app: 2 }, news: 'WHITE HOUSE WON\'T BAN APP' },
    ],
  },

  // ============================================================ DISASTERS & ENVIRONMENT
  {
    id: 'hurricane', cat: 'Disaster', title: 'Category 5 Landfall',
    text: 'Hurricane Delphine just hit the Gulf Coast with 170 mph winds. A major city is underwater and 2 million people have no power.',
    adv: [['FEMA', 'We need everything you\'ve got.'], ['Chief of Staff', 'The cameras will be watching how fast we move.']],
    options: [
      { label: 'All-out federal response', desc: 'Military, FEMA, blank check.', fx: { tre: -12, app: 9, uni: 5 }, news: 'MASSIVE RESCUE OPERATION WINS PRAISE' },
      { label: 'Standard FEMA response', desc: 'By the book.', fx: { tre: -5 }, roll: { p: 0.5, ok: { fx: { app: 3 }, news: 'RECOVERY ON TRACK' }, bad: { fx: { app: -10, uni: -4 }, news: 'FEMA FAILURES LEAVE THOUSANDS STRANDED' } }, news: 'FEMA DEPLOYS' },
      { label: 'Fly in for a photo op', desc: 'Visible leadership, modest aid.', fx: { tre: -3, base: 3 }, roll: { p: 0.45, ok: { fx: { app: 5 }, news: 'PRESIDENT COMFORTS VICTIMS' }, bad: { fx: { app: -7 }, news: '"TONE-DEAF" PHOTO OP SPARKS FURY' } }, news: 'PRESIDENT TOURS DISASTER ZONE' },
    ],
  },
  {
    id: 'wildfires', cat: 'Environment', title: 'The West Is Burning',
    text: 'Wildfires have burned 8 million acres. Smoke is choking cities from Seattle to Denver. Scientists say it\'s the new normal.',
    adv: [['Interior', 'Climate change is making every season worse.'], ['Treasury', 'Firefighting costs are exploding.']],
    options: [
      { label: 'Declare a climate emergency', desc: 'Emergency powers to cut emissions.', pc: 10, fx: { env: 10, eco: -5, base: -4, app: 3 }, news: 'PRESIDENT DECLARES CLIMATE EMERGENCY' },
      { label: 'Fund firefighting & forests', desc: 'More crews, thinning, prevention.', fx: { tre: -6, app: 4, env: 3 }, news: 'FIREFIGHTING FUNDING TRIPLED' },
      { label: 'Blame the states', desc: 'Poor forest management.', fx: { base: 3, uni: -5, app: -4 }, news: 'PRESIDENT BLAMES GOVERNORS FOR FIRES' },
    ],
  },
  {
    id: 'climate_summit', cat: 'Environment', title: 'Global Climate Summit',
    text: '190 nations are meeting to set emissions targets. All eyes are on America. Without you, the deal dies.',
    adv: [['Climate Envoy', 'Lead, and the world follows.'], ['Energy', 'Aggressive targets mean job losses in coal and oil country.']],
    options: [
      { label: 'Bold pledge: net zero by 2040', desc: 'Lead the world.', fx: { env: 12, dip: 8, eco: -4, base: -4 }, news: 'U.S. LEADS HISTORIC CLIMATE PACT' },
      { label: 'Modest commitment', desc: 'Something everyone can live with.', fx: { env: 4, dip: 3 }, news: 'CLIMATE DEAL REACHED; ACTIVISTS UNIMPRESSED' },
      { label: 'Walk out', desc: '"America first."', fx: { env: -8, dip: -10, base: 6, eco: 2 }, news: 'U.S. WALKS OUT OF CLIMATE SUMMIT' },
    ],
  },
  {
    id: 'earthquake', cat: 'Disaster', title: 'The Big One',
    text: 'A magnitude 7.9 earthquake hit Los Angeles. Freeways have collapsed. Thousands are trapped. Damage could pass $300 billion.',
    adv: [['FEMA', 'Search and rescue — the first 72 hours are everything.'], ['Treasury', 'This will need Congress.']],
    options: [
      { label: 'Massive emergency aid', desc: 'Everything, immediately.', fx: { tre: -14, app: 8, uni: 6 }, news: 'NATION RALLIES TO RESCUE LOS ANGELES' },
      { label: 'Aid + rebuild smarter', desc: 'Quake-proof codes for the new city.', pc: 10, fx: { tre: -10, app: 6, eco: 3 }, news: 'LA TO REBUILD "QUAKE-PROOF"' },
      { label: 'Loans, not grants', desc: 'California can pay it back.', fx: { tre: -4, app: -7, uni: -5, base: 2 }, news: 'QUAKE VICTIMS OFFERED LOANS; OUTRAGE' },
    ],
  },
  {
    id: 'drought', cat: 'Environment', title: 'Dust Bowl 2.0',
    text: 'The Colorado River is drying up. Seven states are fighting over water, and farms are being abandoned.',
    adv: [['Interior', 'Someone has to take the cuts.'], ['Agriculture', 'Farmers grow your food.']],
    options: [
      { label: 'Impose water cuts', desc: 'Federal rationing for all seven states.', fx: { env: 6, uni: -4, eco: -3 }, news: 'FEDS IMPOSE HISTORIC WATER CUTS' },
      { label: 'Desalination megaprojects', desc: 'Make new water.', fx: { tre: -12, env: 3 }, roll: { p: 0.6, ok: { fx: { eco: 5, app: 6 }, news: 'FIRST MEGA-DESAL PLANT FLOWS' }, bad: { fx: { app: -4 }, news: 'DESAL PROJECT OVER BUDGET, BEHIND SCHEDULE' } }, news: 'DESALINATION PLAN UNVEILED' },
      { label: 'Let the states fight it out', desc: 'Not Washington\'s problem.', fx: { uni: -6, env: -4, base: 2 }, news: 'WATER WAR BETWEEN STATES ESCALATES' },
    ],
  },
  {
    id: 'chemical_spill', cat: 'Environment', title: 'Toxic Train Derailment',
    text: 'A train carrying toxic chemicals derailed in a small Ohio town. Officials burned the chemicals; residents report sick pets and dead fish.',
    adv: [['EPA', 'Testing says the water is safe. Residents don\'t believe us.'], ['Transportation', 'Rail safety rules were weakened years ago.']],
    options: [
      { label: 'Visit & make the railroad pay', desc: 'Full cleanup, billed to the company.', fx: { app: 5, env: 4, eco: -2 }, news: 'PRESIDENT: "THE RAILROAD WILL PAY"' },
      { label: 'Tough new rail safety rules', desc: 'Prevent the next one.', pc: 10, bill: true, fx: { env: 5, sec: 2, eco: -2 }, news: 'RAIL SAFETY ACT PASSES' },
      { label: 'Trust the EPA testing', desc: 'Stay calm, stay away.', fx: { app: -5, uni: -3 }, news: 'FORGOTTEN TOWN FEELS ABANDONED' },
    ],
  },

  // ============================================================ DOMESTIC & SOCIAL
  {
    id: 'scotus', cat: 'Domestic', title: 'A Seat Opens on the Court',
    text: 'A Supreme Court justice has died. Your pick could shape the country for 30 years. The Senate is already at war.',
    adv: [['White House Counsel', 'This is your legacy, sir.'], ['Chief of Staff', 'A confirmation fight will eat everything else.']],
    options: [
      { label: 'A true believer', desc: 'Your base\'s dream pick.', pc: 15, bill: true, fx: { base: 10, uni: -7, app: -2 }, news: 'FIREBRAND CONFIRMED TO SUPREME COURT' },
      { label: 'A consensus moderate', desc: 'Easy confirmation.', pc: 5, fx: { uni: 6, app: 4, base: -6 }, news: 'MODERATE JUSTICE SAILS THROUGH SENATE' },
      { label: 'A historic first', desc: 'Break a barrier.', pc: 10, bill: true, fx: { app: 5, base: 3, uni: 2 }, news: 'HISTORIC NOMINEE CONFIRMED' },
    ],
  },
  {
    id: 'protests', cat: 'Domestic', title: 'Cities in the Streets',
    text: 'A video of a police killing has sparked protests in 200 cities. Most are peaceful, but some nights end in fires and looting.',
    adv: [['Attorney General', 'The country needs to see real reform.'], ['Homeland Security', 'We need to restore order first.']],
    options: [
      { label: 'Deploy the National Guard', desc: 'Order first.', fx: { sec: 3, uni: -8, base: 5 }, news: 'GUARD TROOPS PATROL AMERICAN CITIES' },
      { label: 'Police reform commission', desc: 'Listen, then change the law.', pc: 10, fx: { uni: 6, base: -4, app: 3 }, news: 'SWEEPING POLICE REFORM PROMISED' },
      { label: 'Address the nation', desc: 'One speech to heal it.', roll: { p: 0.5, stat: 'uni', ok: { fx: { uni: 10, app: 7 }, news: '"WE ARE ONE PEOPLE" — SPEECH HAILED AS HISTORIC' }, bad: { fx: { uni: -5, app: -4 }, news: 'SPEECH FALLS FLAT; PROTESTS GROW' } }, news: 'PRESIDENT ADDRESSES THE NATION' },
    ],
  },
  {
    id: 'shooting', cat: 'Domestic', title: 'Tragedy at a School',
    text: 'A gunman killed 19 children and 2 teachers at an elementary school. The nation is in mourning and demanding action.',
    adv: [['Domestic Policy', 'The public wants a vote. Give them one.'], ['Chief of Staff', 'Any gun bill splits the country down the middle.']],
    options: [
      { label: 'Push a major gun bill', desc: 'Background checks, assault weapons limits.', pc: 20, bill: true, fx: { app: 5, uni: -2, base: -2, sec: 3 }, news: 'LANDMARK GUN SAFETY BILL PASSES' },
      { label: 'School safety & mental health', desc: 'Guards, counselors, funding.', fx: { tre: -6, uni: 4, app: 3, sec: 2 }, news: 'BILLIONS FOR SCHOOL SAFETY' },
      { label: 'Executive actions', desc: 'What you can do alone.', fx: { app: 2, base: -1 }, news: 'PRESIDENT SIGNS GUN EXECUTIVE ORDERS' },
    ],
  },
  {
    id: 'healthcare', cat: 'Domestic', title: 'Healthcare for All?',
    text: '30 million Americans have no health insurance. A massive movement wants a public option. Insurers are spending millions to stop it.',
    adv: [['HHS Secretary', 'It would be the biggest achievement since Medicare.'], ['Treasury', 'The price tag is staggering.']],
    options: [
      { label: 'Public option for all', desc: 'Government plan anyone can buy.', pc: 25, bill: true, fx: { tre: -12, app: 8, uni: 3, base: 2 }, news: 'PUBLIC HEALTH OPTION BECOMES LAW' },
      { label: 'Expand subsidies', desc: 'Make private insurance cheaper.', pc: 10, bill: true, fx: { tre: -7, app: 4 }, news: 'INSURANCE SUBSIDIES EXPANDED' },
      { label: 'Market reforms', desc: 'Sell plans across state lines.', fx: { eco: 3, app: -2, base: 3 }, news: 'HEALTH MARKET DEREGULATED' },
    ],
  },
  {
    id: 'ai_crisis', cat: 'Tech', title: 'The AI That Lied',
    text: 'An AI system triggered a stock market flash crash, and deepfakes of you declaring war went viral before being debunked. Tech CEOs are begging you not to overreact.',
    adv: [['Science Advisor', 'We need guardrails before something worse happens.'], ['Commerce', 'Strangle AI and our rivals win the century.']],
    options: [
      { label: 'Strict AI licensing', desc: 'Powerful models need a license.', pc: 10, fx: { sec: 5, eco: -4, uni: 2 }, news: 'AI LICENSING REGIME ANNOUNCED' },
      { label: 'Industry self-regulation', desc: 'Let the experts police themselves.', fx: { eco: 5 }, roll: { p: 0.5, ok: { fx: { app: 2 }, news: 'AI LABS SIGN SAFETY PLEDGE' }, bad: { fx: { sec: -6, app: -6 }, news: 'ROGUE AI SCAM DRAINS $4 BILLION' } }, news: 'WHITE HOUSE TRUSTS TECH TO SELF-POLICE' },
      { label: 'Global AI treaty', desc: 'Rules for the whole world.', pc: 5, fx: { dip: 5 }, roll: { p: 0.5, stat: 'dip', ok: { fx: { sec: 5, dip: 5, app: 4 }, news: 'WORLD SIGNS FIRST AI TREATY' }, bad: { fx: { dip: -3 }, news: 'AI TREATY TALKS COLLAPSE' } }, news: 'PRESIDENT PROPOSES AI TREATY' },
    ],
  },
  {
    id: 'moonbase', cat: 'Tech', title: 'Race to the Moon (Again)',
    text: 'A rival superpower just announced a permanent moon base by 2030. NASA says we can beat them — with enough money.',
    adv: [['NASA', 'Give us the budget and we\'ll plant the flag first.'], ['Treasury', 'There are more urgent needs on Earth.']],
    options: [
      { label: 'Full moonshot', desc: 'Moon base by 2029.', fx: { tre: -10, app: 5, dip: 3, sec: 3, eco: 2 }, news: 'AMERICA RETURNS TO THE MOON RACE' },
      { label: 'International partnership', desc: 'Share the cost with allies.', fx: { tre: -4, dip: 6 }, news: 'ALLIES JOIN U.S. LUNAR MISSION' },
      { label: 'Cancel it', desc: 'Spend the money on Earth.', fx: { tre: 4, app: -2, base: 1 }, news: 'NASA BUDGET SLASHED' },
    ],
  },
  {
    id: 'veterans', cat: 'Domestic', title: 'Veterans Left Waiting',
    text: 'An investigation found veterans dying while waiting months for VA appointments — and officials faking the records.',
    adv: [['VA Secretary', 'I take full responsibility.'], ['Chief of Staff', 'Heads have to roll.']],
    options: [
      { label: 'Fire leadership, fund fixes', desc: 'Accountability and money.', fx: { tre: -6, app: 5, sec: 2 }, news: 'VA LEADERS FIRED; BILLIONS FOR CARE' },
      { label: 'Private care vouchers', desc: 'Let vets see any doctor.', fx: { tre: -8, app: 4, base: 3 }, news: 'VETERANS GET PRIVATE CARE OPTION' },
      { label: 'Internal review', desc: 'Let the VA fix itself.', fx: { app: -6 }, news: 'VETERANS SCANDAL DEEPENS' },
    ],
  },
  {
    id: 'pardon', cat: 'Domestic', title: 'The Pardon Request',
    text: 'Your oldest friend and biggest donor was convicted of fraud. He\'s asking for a pardon. Nobody would know until you sign it.',
    adv: [['White House Counsel', 'Legally, you can. Politically, it\'s a bomb.'], ['Chief of Staff', 'He knows a lot of things about us.']],
    options: [
      { label: 'Pardon him', desc: 'Loyalty matters.', fx: { app: -8, uni: -4, base: 2 }, flags: ['crony_pardon'], sched: [['investigation', 2]], news: 'PRESIDENT PARDONS DONOR FRIEND' },
      { label: 'Refuse', desc: 'Nobody is above the law.', fx: { app: 3, uni: 2 }, roll: { p: 0.7, ok: { fx: {}, news: 'PRESIDENT DENIES FRIEND\'S PARDON' }, bad: { fx: { app: -5 }, news: 'SPURNED DONOR SPILLS SECRETS TO PRESS' } }, news: 'PRESIDENT: "NO SPECIAL TREATMENT"' },
    ],
  },
  {
    id: 'scandal_aide', cat: 'Scandal', title: 'The Leaked Tapes',
    text: 'Recordings show your top aide promising favors to a foreign company in exchange for campaign cash. The tapes are everywhere.',
    adv: [['White House Counsel', 'Cut him loose before this touches you.'], ['Chief of Staff', 'He\'s been with us 20 years.']],
    options: [
      { label: 'Fire him, full transparency', desc: 'Release everything.', fx: { app: -3, uni: 3, base: -2 }, news: 'TOP AIDE FIRED; PRESIDENT VOWS TRANSPARENCY' },
      { label: 'Defend him', desc: '"Out of context."', fx: { base: 5, app: -8 }, flags: ['coverup'], sched: [['investigation', 2]], news: 'PRESIDENT STANDS BY EMBATTLED AIDE' },
      { label: 'Quietly destroy the evidence', desc: 'Make it go away.', fx: { app: -2 }, roll: { p: 0.35, ok: { fx: { app: 3 }, news: 'TAPES STORY FADES' }, bad: { fx: { app: -12, uni: -5 }, flags: ['coverup', 'obstruction'], news: 'EVIDENCE DESTRUCTION EXPOSED', sched: [['investigation', 1]] } }, news: 'WHITE HOUSE: "NOTHING TO SEE"' },
    ],
  },
  {
    id: 'investigation', cat: 'Scandal', title: 'Special Counsel Appointed', only: 'followup',
    text: 'A special counsel is investigating your White House. Subpoenas are flying, and your former staff are being called to testify.',
    adv: [['White House Counsel', 'Cooperate. Stonewalling is how presidents get impeached.'], ['Chief of Staff', 'Attack the investigation — it\'s a witch hunt.']],
    options: [
      { label: 'Cooperate fully', desc: 'Hand over everything.', fx: { app: 2, uni: 3, base: -3 }, roll: { p: 0.6, ok: { fx: { app: 5 }, news: 'COUNSEL CLEARS PRESIDENT' }, bad: { fx: { app: -6 }, news: 'COUNSEL REPORT DAMNING BUT NO CHARGES' } }, news: 'PRESIDENT COOPERATES WITH PROBE' },
      { label: 'Stonewall', desc: 'Executive privilege on everything.', fx: { app: -6, base: 5, uni: -5 }, flags: ['impeach_risk'], news: 'WHITE HOUSE DEFIES SUBPOENAS' },
      { label: 'Fire the special counsel', desc: 'End it now.', fx: { app: -12, uni: -8, base: 4 }, flags: ['impeach_risk', 'obstruction'], news: 'PRESIDENT FIRES SPECIAL COUNSEL; CAPITAL IN UPROAR' },
    ],
  },

  // ============================================================ SPECIAL: triggered by low meters
  {
    id: 'debt_crisis', cat: 'Economy', title: 'Debt Ceiling Doomsday', only: 'trigger',
    text: 'The Treasury will run out of money in 10 days. If the U.S. defaults, global markets will crash. Congress wants concessions.',
    adv: [['Treasury', 'A default would be catastrophic. Catastrophic.'], ['Chief of Staff', 'Somebody has to blink.']],
    options: [
      { label: 'Deep spending cuts deal', desc: 'Give them what they want.', fx: { tre: 18, eco: -4, base: -5, app: -2 }, news: 'DEFAULT AVERTED WITH SPENDING CUTS' },
      { label: 'Raise taxes to pay bills', desc: 'Revenue, not cuts.', pc: 15, bill: true, fx: { tre: 16, eco: -3, app: -3 }, news: 'TAX HIKES AVERT DEFAULT' },
      { label: 'Mint a trillion-dollar coin', desc: 'A legal loophole. Seriously.', roll: { p: 0.45, ok: { fx: { tre: 15, app: 2 }, news: 'THE TRILLION-DOLLAR COIN WORKS?!' }, bad: { fx: { eco: -10, app: -8, dip: -4 }, news: 'COIN GAMBIT SPOOKS MARKETS' } }, news: 'PRESIDENT ORDERS TRILLION-DOLLAR COIN' },
    ],
  },
  {
    id: 'unrest', cat: 'Domestic', title: 'A Nation Coming Apart', only: 'trigger',
    text: 'Polarization has boiled over. Armed groups are clashing in state capitals, and governors are defying federal law.',
    adv: [['Attorney General', 'We have to enforce the law.'], ['Chief of Staff', 'You need to bring both sides to the table.']],
    options: [
      { label: 'Unity summit', desc: 'All 50 governors, one room.', pc: 15, fx: { uni: 12, app: 4 }, news: 'GOVERNORS SIGN "AMERICAN COMPACT"' },
      { label: 'Crack down', desc: 'Arrest militia leaders.', fx: { sec: 6, uni: 4, base: -3 }, roll: { p: 0.55, ok: { fx: { uni: 6 }, news: 'MILITIAS DISBANDED' }, bad: { fx: { uni: -6, sec: -4 }, news: 'STANDOFF TURNS DEADLY' } }, news: 'FEDS MOVE AGAINST MILITIAS' },
    ],
  },
  {
    id: 'impeachment', cat: 'Scandal', title: 'Articles of Impeachment', only: 'trigger',
    text: 'The House has impeached you for obstruction of justice. The Senate trial begins Monday. Removal needs two-thirds of senators.',
    adv: [['White House Counsel', 'We can win this — if you don\'t lose more votes.'], ['Chief of Staff', 'Some senators are wavering. Very publicly.']],
    options: [
      { label: 'Fight it in the Senate', desc: 'Make your case.', roll: { p: 0.6, stat: 'base', ok: { fx: { base: 8, app: -2 }, news: 'PRESIDENT ACQUITTED IN SENATE TRIAL' }, bad: { fx: {}, flags: ['removed'], news: 'PRESIDENT REMOVED FROM OFFICE' } }, news: 'SENATE TRIAL BEGINS' },
      { label: 'Resign', desc: 'Spare the country the trial.', flags: ['resigned'], fx: {}, news: 'PRESIDENT RESIGNS' },
      { label: 'Apologize & offer reforms', desc: 'Throw yourself on their mercy.', fx: { app: 4, base: -6 }, roll: { p: 0.7, ok: { fx: { uni: 4 }, news: 'CONTRITE PRESIDENT SURVIVES TRIAL' }, bad: { flags: ['removed'], fx: {}, news: 'APOLOGY NOT ENOUGH; PRESIDENT REMOVED' } }, news: 'PRESIDENT APOLOGIZES TO NATION' },
    ],
  },

  // ============================================================ CAMPAIGN (forced near election)
  {
    id: 'campaign', cat: 'Campaign', title: 'Campaign Strategy', only: 'campaign',
    text: 'Election Day is six months away. Your campaign manager needs a strategy and a budget — now.',
    adv: [['Campaign Manager', 'Elections are won on turnout.'], ['Pollster', 'Independents will decide this one.']],
    options: [
      { label: 'Fire up the base', desc: 'Rallies, red meat, turnout.', fx: { base: 10, uni: -4 }, flags: ['camp_base'], news: 'PRESIDENT\'S RALLIES DRAW HUGE CROWDS' },
      { label: 'Court the middle', desc: 'Moderate message, swing states.', fx: { uni: 3, base: -3, app: 3 }, flags: ['camp_middle'], news: 'PRESIDENT PIVOTS TO THE CENTER' },
      { label: 'Go negative', desc: 'Make it about your opponent.', fx: { uni: -6, app: -2 }, roll: { p: 0.5, ok: { fx: { app: 2 }, flags: ['camp_negative'], news: 'ATTACK ADS SINK CHALLENGER\'S NUMBERS' }, bad: { fx: { app: -4 }, news: 'NEGATIVE ADS BACKFIRE' } }, news: 'CAMPAIGN TURNS NASTY' },
    ],
  },
  {
    id: 'debate', cat: 'Campaign', title: 'The Debate', only: 'debate',
    text: '80 million people are watching. Your opponent is sharp and well-prepared. The moderator turns to you for the first answer.',
    adv: [['Debate Coach', 'Stick to the record.'], ['Campaign Manager', 'Go for the knockout line.']],
    options: [
      { label: 'Defend your record', desc: 'Facts, figures, steady.', roll: { p: 0.6, stat: 'eco', ok: { fx: { app: 4 }, flags: ['debate_win'], news: 'STEADY PRESIDENT WINS DEBATE' }, bad: { fx: { app: -3 }, news: 'PRESIDENT SOUNDS DEFENSIVE' } }, news: 'DEBATE NIGHT' },
      { label: 'Go for the knockout', desc: 'Big moment, big risk.', roll: { p: 0.4, ok: { fx: { app: 8, base: 5 }, flags: ['debate_win'], news: 'KNOCKOUT LINE GOES VIRAL; PRESIDENT DOMINATES' }, bad: { fx: { app: -7 }, news: 'ZINGER FLOPS; PRESIDENT STUMBLES' } }, news: 'DEBATE NIGHT' },
      { label: 'Talk about the future', desc: 'Optimism, vision.', roll: { p: 0.55, stat: 'uni', ok: { fx: { app: 5, uni: 3 }, flags: ['debate_win'], news: 'PRESIDENT\'S VISION INSPIRES' }, bad: { fx: { app: -2 }, news: 'PRESIDENT VAGUE ON SPECIFICS' } }, news: 'DEBATE NIGHT' },
    ],
  },

  // ============================================================ SECOND TERM ONLY
  {
    id: 'legacy_project', cat: 'Legacy', title: 'Your Legacy Project', term: 2,
    text: 'You\'re a lame duck with one big push left. Historians will remember one thing. What will it be?',
    adv: [['Chief of Staff', 'Pick one thing and win it.']],
    options: [
      { label: 'Universal pre-K', desc: 'Every 4-year-old in school.', pc: 15, bill: true, fx: { tre: -8, uni: 6, app: 6, eco: 3 }, news: 'UNIVERSAL PRE-K SIGNED INTO LAW' },
      { label: 'Balanced budget amendment', desc: 'Fiscal discipline forever.', pc: 20, bill: true, fx: { tre: 14, eco: -2, base: 6 }, news: 'BALANCED BUDGET PUSH SUCCEEDS' },
      { label: 'Middle East peace deal', desc: 'The impossible dream.', roll: { p: 0.3, stat: 'dip', ok: { fx: { dip: 15, sec: 8, app: 10 }, news: 'HISTORIC PEACE ACCORD SIGNED' }, bad: { fx: { dip: -4 }, news: 'PEACE TALKS COLLAPSE AGAIN' } }, news: 'PRESIDENT LAUNCHES PEACE INITIATIVE' },
    ],
  },
  {
    id: 'third_term', cat: 'Legacy', title: 'Four More Years?', term: 2,
    text: 'Your loudest supporters are calling for you to "find a way" to serve a third term. The Constitution says no.',
    adv: [['White House Counsel', 'There is no way. Full stop.']],
    options: [
      { label: 'Shut it down firmly', desc: '"The Constitution is clear."', fx: { uni: 5, app: 4, base: -3 }, news: 'PRESIDENT REJECTS THIRD-TERM TALK' },
      { label: 'Wink and smile', desc: '"Who knows?"', fx: { base: 6, uni: -7, app: -5 }, news: 'PRESIDENT TOYS WITH THIRD TERM; CRITICS ALARMED' },
    ],
  },
  {
    id: 'successor', cat: 'Legacy', title: 'Choosing a Successor', term: 2,
    text: 'Your party is picking its next nominee. Your endorsement could decide it.',
    adv: [['Campaign Manager', 'Your legacy depends on who follows you.']],
    options: [
      { label: 'Endorse your VP', desc: 'Continuity.', fx: { base: 4, app: 2 }, news: 'PRESIDENT ENDORSES VICE PRESIDENT' },
      { label: 'Endorse a fresh face', desc: 'A new generation.', fx: { uni: 4, base: -2, app: 3 }, news: 'PRESIDENT BACKS RISING STAR' },
      { label: 'Stay neutral', desc: 'Let the voters decide.', fx: { uni: 2 }, news: 'PRESIDENT STAYS OUT OF PRIMARY' },
    ],
  },
];

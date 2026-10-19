# Hand-written skill lines — working notes (read this first after a context break)

Goal (owner, 2026-10-11 22:34): EVERY card of the Japanese pool fully automatic. The reader (`tools/skillc.mjs`) has a flat tail, so the rest is written by hand
in the same structured form the reader produces, one entry per unreadable line, in `tools/hand-ast.txt` (no card wording in it: keys are hashes).

## Loop
1. `node tools/fl.mjs [regexp] [--n 40] [--from N] [--why step|cond|trigger|"cont body"|…] [--card re] [--one] [--manual]` → `key xCards {first card} canonical line` (+ bullet lines). `--stat` = totals. Reads `data/fails.jsonl` (written by mkdb).
2. Append entries to `tools/hand-ast.txt`:  `<key> <json>`  (or `@Card Name<TAB>{whole-card ast}` for cards without English wording).
3. `node tools/mkdb.mjs && node tools/astcheck.mjs` (names known? builds? Thai text has no hole?) → `node tools/mkjp.mjs && node build.mjs` → tests (`QUIET=1 node test/dbsim.mjs 300`, `node test/fx.mjs`).
   `node tools/astcheck.mjs --show <key>…` prints the Thai text the game shows.
4. A mechanic the runtime lacks → add the step / cond / trigger / cost to `src/fx.js` (+ its Thai text in thStep / thC / thTrig) and engine support in `src/engine.js`; note it below.

## Entry forms
- one ability, short form: `{"on":{…},"c":[conds],"k":[costs],"d":[steps]}` — `t` (a/k/c), `z` (zone) and `l` (1/turn) are taken from the line's own header; give `"z":0` / `"l":0` to drop them, or set them to override.
- several abilities from one line: `[{…},{…}]` or `{"a":[…]}`.
- card-level fields beside/without `a`: `p` (order play: `{k,c,d,from}` merged into the order), `o` (over-trigger extra effect steps), `tg` (tags), `od`, `nr`, `nnc`, `sentinel`, `as` …
- names: `«0»`, `«1»` = the quoted names of that card in order of appearance (filled in at build time). A quoted ABILITY is also a «n» — write the granted ability out as nested AST.

## Ability
`t`: `a` AUTO (needs `on`), `k` ACT, `c` CONT (`m` = mod, `s` = who gets it (group; default this unit), `per` = count multiplier). `z`: V R G VR RG Rf Rb Rc D S H O B or a list. `l:1` once per turn. `dv:1` Divine Skill.
`as:1` + `d:[["man"]]` = half-automatic (not wanted any more).

## Triggers `on:{e:…}`
placeRC {from:[zones], nfrom, vc:1 (VC or RC), row, pos, ph, by, od} · placeVC {ride:1, ph} · rideFrom {f} · placeGC {from, ic:1 intercept} · atk {tg:{k:'v'|'r',…filter}, bo:1|0, bof, ob:1 attacks or boosts, ph}
boost {tg} · boosted {tg} · hit {tg} · bhit · vhit · end {a:1 attacked, b:1 boosted, hit:1, bo, bof, tg, w:'v'|'r'|'u' + wf = "your … attacked"} · rode {by:filter} · disc {from, ph ('rd' = ride-deck discard), by}
toOrder · revealed (drive check) · stood {ph, by} · sbcost {n, by:'v'} · endChk {f} · uDisc · retGC · retRC {gc:1, ph, by} · bounced · toSoul {from} · bound · atked {w:'me'|'v', wf}
tend {opp:1, each:1} · phase {ph:'r'|'m'|'b', opp:1} · vatk/uatk {wf, tg, ot, col} · vplace {wf, ph} · uplace {wf, from, ot, ph, by} · dcheck {k:'t'|'n'} · order {k:'n'|'s'|'b', f} · oret {ph, by} · pride · state {n}
uAtk uPlace uStood uRet uAtked uHit uSoul uBounce {s:'m'|'o'|'x', k:'u'|'v'|'r', wf, tg, from, nfrom, ph, by} · dress · chosen {by:{k,gmin,nh,nm}} · retCol {row} · pst
`ph`: m b r (your phase) · t your turn · o opponent's turn · nb outside battle. `by`: a your card's ability · v your vanguard's · x any card's · o opponent's · nu not a unit's · c as cost (+byv, byf).
`alt:{e:…}` = "or when …" (second trigger).

## Conditions (lists; and/or/not nest)
vg {gmin,gmax,nh,nh2,nm,nm2,rc} · ovg n · vgLt · vgLe · second · persona · noRide · ord k · noOrd · ordN op n · cnt zone op n · ocnt zone op n · noCB · units 'r'|'u' op n F · uq 'm'|'o' 'u'|'v'|'r' op n F
orgs op n · ofront0 · front0 · back0 · rgMore · noSame · has zone n F · cntD zone 'g'|'n' n · boosted · row f|b · placedNow · bno op n · atkVG · didHit · noHit · atk2 · noGuard · oretT · otrigT
phase m|b|r · my · opp · attacking · boosting · bstIs F · crest name · in state · world d|a|da · tl k s by from · placedBy v|a · placedFrom zone · allSt k F r|s · drew · itIs F · putTo zone · did · got · none
dmgDown op n · dmgUpN op n · zone Z · stIs r|s · atkIs v|r · atkBoosted · atkGrade op n · atkPow op n · tgGrade [a,b] · ods o|x · evod · mkc · mkon · mkcol · mkopp · chosen by · nopst · wings w|b · whereIs zone · noSameIt

## Costs
cb n · sb n · eb n · alt [a…] [b…] · self soul|retire|bind|rest|drop|bottom|removed|hand · disc n F · h2s n F · d2b n F · rrg n F · rg2s n F · rrest n ot · zc n F from to · mill n · rgc n F rest|hand|bottom|bind · rride F · rhand F

## Steps
draw n · sc n · cc n · ec n · shuf · pay [costs] (asks; stops the rest when not paid; sets did) · ch {s:'m'|'o', k:'u'|'v'|'r'|'atkd', n, up:1, f} → it · pk [zones] n up F → it (zones: hand drop soul bind damage order ride deck looked)
sr [zones] n up F (search) · lk n (look at top n → looked/it) · rvt n (reveal top n) · reveal · to it|me dest reveal? (hand soul drop top bottom tb order bind removed dress) · rs bottom|drop|soul|top (rest of looked)
cl it|me {gc,open,col,row,pos,rest} · rt me|it|group · rtall row col · st group · re group · bf group mod dur per (dur t b o; mod: power shield crit drive boost intercept driveMin cantBeHit cantAttack cantIntercept cantBoost guardMin noRetOpp resist backAtk backInt)
pget [abilities] t|f · grant group ability|[abilities] dur · tk name n optional open pos · or A B · topTo n zone · ride it|me · if cond steps [else] · may steps · later b|t steps · modal [{c,k,d}…] all?
odisc n · oret n · odraw n · lock · mk name {no,n} · pst · odrop · hostsel · state name dur · pfx guardMin|noInt dur n · man
groups: me it it+me all front rgs vgs backrg frontrg others otherrg col colo boosted attacker, or {s,k,f} = all matching units.

## Filters (F)
g [min,max] · nm name · nh part (nh2) · rc race · na nation · dn (other name than this) · dnv · sn (same name) · snv · gl · op [op,n] printed power · ty u nu tu o no so bo · tr [triggers] · ns · nov · nn name · pr · oda · ods · odn
mk · tag · gv 1|2 · ot (other) · tk · col · row f|b · st s|r · dist (different names; in counts/choices) · colit · or [F…]

## Added for the hand-written lines (keep this list current)

- GENERAL (2026-10-11): numbers may be count expressions `[kind,…]` in draw/sc/cc/ec/lk/rvt/topTo/odisc/oret/odraw/dmg/heal/rep and as `n` of ch/pk/sr/pkn.
  counts: n k · it [F] · var name · zf zone F · ozf zone F · zs [zones] F (zones also rc gc o:zone it $kept) · zd [zones] g|n F (different grades/names) · tl {query} · add/sub/mul/min/max a b · pw|cr|gr|ppw who (me it vg ovg atk tgt bst evt by) ·
  energy · bno · turn · open · ff key · tf key [o] · pd i (cards the i-th cost took) · pdg i (sum of their grades) · itg (sum of grades of it) · looked · rest · oopen [f|b] · paid (cards taken by all costs except cb/sb/eb)
  conds: cmp count op n|count · gt a b · tlq {query} [op n] · v name · uis who F · ff key · itn op n · stn state [who] · pos FL… · evf F · first · turnN op n · battle · rested [who] · tgIs F · atkF F · energy op n · sameIn zone(s) · itSame [n] · itDiff [n] · itDg [n] · itDiffEx name · pdIs i F
  turn log query {k: mv|ab|atk|hit|chk|ord|cost|stand, s: m|o|x (whose), to, wanted, from, nfrom, reason, nreason, kind, tz, az, trig, n, me, notme, ride, rf (rode from name), normal, type, zone, divine, boosted, row, battle (this battle), by: a|v|c|o|x|n|me|sn, byf, f, sum, fight:1, th: 'Thai text'}
  steps: set name count · keep name / use name / also name (remember it) · itf F · itg group · itz [zones] F · itu who · itin zone(s) · itgr n · opp [steps] (opponent does them) · each [steps] · rep n [steps] · stop · ffset key · tfset key [n] [o] · dmg n [me] · heal n · cb n · eb n ·
  stu state [who] · say text · col (choose a column) · itcol m|o|x u|v|r [F] · colit · gup n (grade + this turn, any zone) · rvu F (reveal until) · persona · noride · t1atk · playfrom zone after · play (free) · actfree · pkn zones n up F (same name) · swap [me] · mv me|it {row,col} ·
  match · declare [labels] var · lk n o (opponent's deck) · if cond steps else · later b|t|S|R|M|B|E|oS|oM|oB|oE steps · ride it|me [rest] [carry] · pget abilities t|f|o · pfx key dur n [o] (scPlus rearDrive trigPlus …) · cl {last:1} · rs bind|hand|removed
  filters: or (combines with the other keys) · nnh · rch (race contains) · nin zone · inz zone · faceup · pw [op,n] · placed · kw boost|intercept · ng [a,b] · nty · stt state · tru · gle · pos [circles] · srv · pby v|a · distg
  mods (bf / cont m): noStand noMove atkBack atkAllFront atkCol atkColRG atkPlus2 rgDrive g0guard noCont grade trigPlus cantAtkVG noAtkByRG cantBeAtk backAtkRG backAtkC alsoHitByVG noRet noRetOwn
  groups: gc ogc oall orgs ofront ovgs evt · object groups k: 'g' = guardians
  costs: rgc n F how kind min ('all'; how also retire soul stand; kind 'u') · zc n F from(s incl. 'rc') to inc min (F.dist) · cost results are card lists (pd / pdIs)
  triggers: gstart {w,wf} (start of guard step when your unit is attacked) · astep · dcheck {k:'a'|'t'|'n', f, kind, s} · oret {gc:1} · zones M (damage) X K C T
  engine: G.tl generic records (tlog), G.fl fight log, laters S/R/M/B/E per player, order-zone cards stand in the stand phase, c.lastPos, c.pf (play from), c.gmod, playFree, actFree, moveUnit, tf: omax nopersona noride t1atk
  "all X get [AUTO]…" continuous lines are written as a trigger on the source card (uHit / uAtk … with wf) — same controller, same result.
  Deferred keys (need a mechanic or data not there yet) are in `tools/defer.txt`; `node tools/fl.mjs --deferred` lists them. `--plain` hides lines that mention special mechanics; `--alpha` sorts by the text after the header.
  DATA GAPS: order subtypes (Grimoire, Cursed Play, Magazine, Strategy, Fashion Magic, Crimson Moon, Research…) and clans / character icons are NOT in the crawl (wiki `ct` = "…X" only says "has a subtype") → those lines are deferred until re-crawled through the owner's browser.

## Added in batches 11–24 (2026-10-11, second half) — same rules as above
- Tools: `tools/cycle.sh [fl args]` (mkdb + astcheck + stat + list) · `tools/ast.mjs <name re>` prints a card's compiled form · `tools/subtype.txt` = order subtypes the lists do not give (Name<TAB>Subtype, stored like a race: `{"rc":"crimson moon"}`, `"gran magick"`, `"base"`; codex / tiding / arena / calamity / fox art / research … come with the official list).
  Keyword reminders found in the data: Ritual X = drop has X+ grade 1 cards · Shinken Hissatsu = 3+ damage · wings (w = bind zone only odd grades, b = only even).
- Card-level keys: `p.fromC` (cond for play-from-zone) · `p.il` (cond: ignores the order-per-turn limit) · `ncc` (normal call only if conds) · `na2` (second nation) · `cl` (count: the card's counter-blast costs are reduced by it) · `bind` (['self'|'cost'|'lock']) · `noOrdAb` · `sina` ({c,k,d} Sinastery; step `["sina","me"|"it"]`) · `x` (Thai note for a rule another entry enforces — use only then) · `cp cb ss ig` as before.
- Costs: `cbx min` (counter-blast any number; `["pd",i]` = how many) · `zc "all" F from to` · `zc n {distg:1} …` (different grades) · soul→drop costs are logged as `{k:'cost',kind:'sb',n}`.
- Triggers: `mvd {s, me:1, ot:1, to, from:[…], nfrom, reason, f, ph, by, byv, byf}` any card changed zone (orders: give `"z":"B"|"D"|"S"|"H"` where the card is afterwards; units: `"z":0`) · `rvd {s, f, by, byf}` revealed by an ability · existing: uAtk uPlace uHit uRet stood bhit vhit end disc retGC revealed toOrder toSoul vplace uplace dcheck oGuard atked.
- Conds: `evby v|a|o|c|x|me [F]` (how the event came about) · `critUp [who]` · `trigPw` · `["phase", m|b|r|s, "x"]` (either player's; plain = yours) · `["world","s"]` Stray Garden (mod `worldSG`) · modal options take ONE cond (`["and",…]`).
- Counts: `dr who` · `psh who|it` (printed shield) · `["tl",{k:'cc'|'ord'|'cost'|'stand'|'chk'|'mv'…, rfg: n (rode from grade n), th:'Thai'}]`.
- Steps: `pay` also stores the cards it took (`["use","paid"]`) · `rvu F n` · `pksum zones n F limit {eq,any,dg}` · `itgr n "ne"` · `itnk kept ["same"]` · `ordonly 0` (no more orders this turn) · `cl {repl:"soul", gc:1 (also moves an opponent's rear-guard to GC)}` · `st` also stands order-zone cards · `pfx bothWings o 1`.
- Mods: `ordDiff` `worldSG` `callBounce` `atk3` `oSoulBottom` `boostAny` `rgDrive` (uses the unit's own drive) `guardMin` `noSentGuard` `g0guard`.
- Engine: event `moved` after every zone change, `revealedBy`; `tf.ordn<p>` names of orders played; mv records carry `rfg`; `c.critUpT`.
- Still deferred (tools/defer.txt): special moves, memory/G zone/stride, gauge, prison, arms, music orders on RC, monster box, scout/base, toy hangar, garden, oversoul, retry, explosive growth, Friends, dominate (also Myun's Sinastery), alchemix, cursed play / grimoire / magazine / tactics subtypes (not in the data — fill tools/subtype.txt), cost substitutes ("may be revealed/discarded as …"), move-within-row.

## Added in batches 25–35

- Costs: `mill n` returns the cards it put into drop (`["use","paid"]`) · `zc` logs soul-blasts · `cbx` variable counter-blast.
- Filters: `ncol` (not in this column) · `snz rc|u|[zones]` (same name as a card there — `inz` only means "is in that zone") · `ngz zone` (its grade is not among my cards in that zone) · `sen` (sentinel) · `nty:"nu"` (not a normal unit) · `nin:"rc"` · `mylast` (on the circle this unit was on) · `nrc "Race"` (not that race) · `gva:0` works (tested with `!= null`).
- Counts: `atkn who` (attacks this turn) · `ev key` (number on the event: batch, over, rideFromG, n) · `psh` · `dr`; turn-log query keys `col`, `rfg`, kinds `rev cc sc place ret cost` and any custom kind left by `["note", key]`.
- Conds: `evz key value` · `evcol` (the event's card is/was in this column) · `overIs F` · `trigPw ["me"]` · `chosen by who` · `evby` · `critUp` · `["phase", X, "x"]` for either player's phase (always use it inside `not`).
- Triggers: `restd {by,byf}` · `scd` (I soul-charged by an ability) · `actd {zone,f}` (I used an ACT) · `pwup {act,by,byf}` · `uchosen {k,wf}` (my unit was chosen by the opponent's ability) · `mvd … multi:n` (n cards moved by one step) · `sbcost {n,by,byf}` · `order {k,f,from:[…],s:'o'}` · `placeVC` / `placeGC` take `by/byf` · `uboost {tg,ot}` (a unit of mine boosts). Trigger `from` is always a list.
- Steps: `mboost group` (sets var `boosters`) · `retarget` · `copyab f|t` · `tgall front` (the attack battles all front-row enemies) · `itev key` (it = the card the event names: iid, rideFromIid, by, booster) · `cl {na, mypos, repl, gc}` · `to it damage` (no text for `to it deck` — use bottom + shuf) · `note key` (mark in the turn log; ask with `["tl",{k:key}]`) · `bst` (this unit boosts the attacker now).
- Mods / player effects: `noHitRet` · `atkVG1f` · `sentBind` · `noSoulByVG` · `pfx noAutoAll b 1 o` · `pfx bindSafe o <name|1>` · `pfx bothWings`.
- Card-level keys: `ncc` (normal-call only), `na2`, `cl`, `bind`, `noOrdAb`, `sina`, `x`, `p.il` (ignores the order limit), `p.fromC` (may be played from a zone); `tg`, `bind`, `x` from several hand entries are joined.
- Engine: events `rested`, `moved` also for RC→RC (`shifted(iid)`), `revealedBy` (+ turn-log `rev`), `actUsed`, `powerUp`, `soulCharged`; `cur.type`; `evt.st` / `G.stepNo` (cards moved by one step share a number); guard `batch`; placeRC `over` / `overNo`; playOrder `from`; `rideFromG` is the PRINTED grade of the old vanguard (computing it after the move crashed).
- Working style: big shell heredocs time out — write the engine/fx patch as a python file (`rep(old,new,count)` with an assert) and the batch as a text file, then run one short command.
- Left after batch 35 (`tools/cycle.sh --plain --alpha`): 45 distinct plain lines — deck-building rules ("up to sixteen/four in a deck"), "you cannot ride/call …" restrictions, cost substitutes ("you may pay … for this cost"), over-soul lines (`⟦os|name⟧`), Völundr / oversized / unknown keywords, two-player simultaneous choices, Monster Box lines.

## Added in batches 36–45 (2026-10-12)

- Tools: `tools/nx.sh [n] [from] [width]` = mkdb + astcheck + stat + the next lines that mention NO special mechanic (the walk now follows this list) · `tools/fam.mjs [--deferred]` counts the remaining lines by mechanic word · `tools/fl.mjs --not <regexp>`.
- Data: `tools/subtype.txt` now also holds Meteorite ×2, Research, World, Prison ×2, Gem ×2, Event ×9 (Touken Ranbu set orders). CLANS are still missing (83 lines): the official card list shows the clan after the race — `WebFetch https://en.cf-vanguard.com/cardlist/cardsearch/?keyword=<Clan>&view=text&sort=no&page=N` lists the cards of a clan (24 per page, all eras), which could fill a `tools/clan.txt`.
- Costs: `ebx min` (energy-blast any number; `["pd",i]`) · `ebr n count` (energy-blast n reduced by a count) · `rride F n` / `rhand F n` · `dz n F` (originalDress of this unit to drop) · `zc … "bindfd"|"ridefu"|"damage"|"order"` · `self bindfd|ridefu|damage|order` · `orest` and `self rest` of order cards are logged (`k:'orest'`).
- Filters: `reg:1|0` (Regalis Piece) · `gvar:"v"` / `gvle:"v"` (grade equals / at most the variable set by `["set","v",…]`) · `rd` (was in the ride deck) · `rfu:1|0` (face up in the ride deck) · `unl` (unlocked this turn) · `swl` (SweetLink state) · `chby:{by-spec}` · `osh:[op,n]` (printed shield) · `dup` (has DressUp) · `me` · `ovz` (Oversized!) · `frd` (is "Friends") · `faceup:0` works for face-down bind / order / damage cards.
- Counts: `lockn m|o|x` · `odn` · `odpw` · turn-log kinds `ec` (energy charge, `sum`), `cost`+`kind:'eb'` (+`type:'act'`, `n`, `sum`), `orest`, `unlock`, `lock`, `look`; query keys `prev:1` (the previous turn), `pwmin` (attacker's power).
- Conds: `unlT` · `unlPrev` · `opersona` · `["has","crest",n,F]`.
- Triggers: `trigz` (put in the trigger zone) · `unlockd {me,s,ot,wf,ph,end}` · `ustate {n,ph}` (this unit enters a state) · `uchosen {my:1,by:{…},k,wf}` · `uboost {wf}` · `endAtked {w:'u'}`.
- Steps: `modal opts 0 count` (perform that many different options) · `noact "sn"|name` · `cbl {play,nm,nh,rc,n,keep,any}` (counter-blast discounts this turn) · `otk name` (token card into the order zone) · `rideonly {nh,gmin}` (fight) · `nocall` · `itrd` · `unlock` · `itfd` · `ebonly [names]` · `itgin name` · `stx state` · `od me|it F` (overDress onto a rear-guard) · `win` · `regoff` · `fus` · `to … bindfd|ridefu|dropnr` · `cl {onv:"kept"}` · `mv … {pos}` · durations `f` (fight) for bf / grant / pget · `pget` also carries AUTO / ACT (they follow the vanguard: `P.pabs`).
- Mods: `basePw` `baseSh` `baseCr` (original value becomes n) · `energyMax5` · `gcSoul` · `lose7` · `ord3` · `noBlitzG` · `cbLess1` (existing) · `noNuGuard` `noTrigGuard` `noHandGuard` (existing, on the attacker); player effects `pfx noBlitz b 1 o`, `pfx lose7 t|f 1`.
- Card-level keys: `ra:[{z:'V'|'R'|'VR', f, c, k}]` (other ways to pay the ride-deck ride; no `k` = free) · `p.fc` (conds: play without the cost) · `as2` · `of` (filter: during your turn only these orders may be played) · `ovp` (lower body: name part of its upper body) · `pa` / `pf` (persona ride with other names) · `rby` (ridden only by the ability of X) · `rov` (on VC: only cards with that name part may be ridden) · `rc2` (extra subtype/race) · `asSet` · `world`.
- Engine: `G.unlock(iid)`, `G.oversized(c)`, `G.loseAt(p)`, `G.rideAlts`, `G.ptl` (previous turn's log), `P.pabs`, destinations `bindfd` / `ridefu` in `move()`, `c.rd`, `c.rfu`, `c.unlockT`, `tf.cbl/noact/nocall/ebonly/rdisc`, `fight.rideOnly`, `G.fxv` (step variables seen by filters).
- Deferred families now (tools/defer.txt, ~430 keys): Buddyfight (gauge, buddy soul, call cost, link attack, soulguard) · special moves (Inazuma) · prison · arms · gauges of every kind (automod, regress, plant, undercover, astral plane, charm) · stride / G zone · clans · music orders on RC · Monster Strike gacha · Touken crests (Ability Kiwame) and Training Equipment · over-soul · tokens called to RC (Blast, Noblesserose, Ubermensch) · face-down order zone (Astroea) · unmoor · delete · d-legion / mate · retry · operate · scout · garden · friend ride · "counts as two" · name copies · dragontree over-trigger · order-zone "become" lines.

## Added in batches 46–49 (2026-10-12, Version 28)

- Walk: `tools/nx.sh` is EMPTY now (no line without a special mechanic is left). Work goes family by family: `node tools/fam.mjs` / `--deferred`, `node tools/fl.mjs <re> --all` (deferred and not), `--nation <re>`, `node tools/nm.mjs <name part>` (rows incl. tokens and cards outside the Japanese pool). `tools/defer.txt` is cleaned automatically of keys that got an entry (python snippet in the batch command).
- Rows outside the Japanese pool (no `jno`, ~518: English-only promos, G units, tokens) are NOT counted and not listed by fl.mjs; their lines are only written when a pool card needs them (tokens: SYSTEM CODE: X-ceed done).
- Batch 46–47: filters `usd` (UnisonDress tag or state) `tkt` `noab` `nsz:[zones]`; conds `rfst state` `rfIs F`; count `itsn zone`; steps `asrf` `gcrest name` `unmoor`; triggers `unmoor` `cbd` `lockd {s,by,byf}`, `vplace` with by/byf; mod `gcBindFd`; card keys `cf` (call filter) `cag` (call ignoring grade) `roo {nh,gmin}` (order-zone ride bar); zone code `Y` = dress; dest `damagefd`; `tf.freeset`; rgc how `bindfd`.
- TOKENS (batch 48): `["tk", name, n, optional, open, pos, {col:1|2, row, mypos, unit, rest, it}]` takes ANY token name: the two built in, a token row of the card list (type X with a power → def.type 'token'; Momokke power fixed by `TOKPW`), or an extra token of `XTOK` in src/db.js (`'TOKEN/x:<lowercase name>'`: Blast, Goat, Zerith "Fantôme" token; order tokens `ord:1`: Moon Gate, Erosion Fantôme Cage). `otk name` prefers XTOK. Filter `tk: 1 | "name"` (case-insensitive; also `def.tokenAs`, card key `tkas`). Card keys: `psink:"Name part"` (Plant tokens become this unit's plant gauge while the vanguard has that name; retire-costs a Plant token could pay may take those gauges: `plantAlt`), `tkas`, `cot` (normal call only onto a circle with a token), `nc` + own `cl me` works. Cond `overTok 1|name` (placed onto a token). Order tokens may now sit in the order zone (they vanished before — bug fixed).
- GAUGES (batch 48): zone `gauge` (code `Z`; `c.gk` kind, `c.gh` host card or null). Kinds: bf (Buddyfight, not written yet) regress automod astral (need a permitting card: card key `gz:"kind"` or step `gzok kind`) plant undercover charm arma g. Destinations for `to` / costs: `"gz:kind"`, `"gzfd:kind"` (face down), `+":me"` (of this card), `":it"`, `":h"` (the unit kept as `["keep","h"]`). Steps `gzt n kind {fd,host}` (top of deck) · `gztk token n host` · `gzre kind` (all onto it[0]) · `gzun kind` · `gzok kind` · `ith` (it = my host) · `gless`. Costs `gp n` (pay bf gauge) · `gd n kind {host,min,f,plus:F}` · `gzc n F [zones|rc] kind {self,host,fd,min,inc}`. Counts `gz kind F` · `gzme` · `gzit` · `gztr namepart`. Conds `gzIs kind` · `gzok kind`. Filters `gk` `gh` `hgz` `nogz` `hostme`. Triggers `gzd {me,gk,ph,by,from,ot,col,hf}` · `gzdisc {me,gk,ph,cost,n}`. Card key `charm` (Protection Charm). Turn log kind `gauge` (+`gk`). A host leaving the field / order zone drops its gauges.
- Also batch 48: steps `opt [steps]` (optional part: a declined `pay` inside only ends that part) · `sb n` · `asn name` · `xturn {skipRM,vmod}` (additional turn: `G.xtq` / `G.xt`) · mods `immune` (not chosen / moved / changed by the opponent's cards) `vgTrig` (shares trigger effects given to the vanguard) `gLess` `driveSet` · filter `natkd` · count `pdpw i` · abilities granted to a unit still fire as it leaves (`c.grantedOut`) · look log has byP/byNo.
- PRISON (batch 49): zone `prison` = MY cards imprisoned in the opponent's Prison (so "the opponent's cards in my prison" = `O.prison`: cond `["jail",op,n]`, count `["jailn"]`, zone `"o:prison"`; inside `["opp",[…]]` the zone is `"prison"`). `["to","it","prison"]` / `["topTo",1,"prison"]` only work while the other side has a Prison (race `Prison`) in the order zone; the last Prison leaving frees everything to drop. Card key `jail:1` on the Prison: the imprisoned fighter's vanguard carries two ACTs (`VG.JAIL`: SB1 → call 1, CB1 → call 2; step `jcall`; blocked by `["pfx","noJail","o",1,"o"]`, cond `pfxOn key`). Trigger for "placed from prison": `uPlace {s:'o',k:'r',from:['prison']}`. Card key `prsc` (Seza: a [Prisoner] put into soul counts as soul-charged); tag `prisoner` is in the data.
- UI: piles GAUGE and IN PRISON (shown only when not empty); card window says whose gauge a card is.
- test/sim.mjs: invariants know the new zones; `DBG=1 FROM=<seed> node test/dbsim.mjs <seed>` prints where a game got stuck (an ACT with no cost and no effect loops the bot — give it a condition).
- NEXT families (by size): clans (80+12, data missing → fetch lists from the official site), Buddyfight (107 lines + 119 cards without English wording: gauge `bf`, call cost, buddy soul, armed/item, flag, soulguard, penetrate, double attack, counterattack, link attack, final phase / impact), Monster Strike (gene / product / gacha), music orders on RC (BanG Dream!), memory / G zone / stride / generation break, arms, markers, alchemagic / alchemix, meteor, Malefics gauges, Shinemon icon + astral plane (rule card "Astral Plane" is outside the pool), special moves, energy leftovers, "become"/"regarded" lines, then the 252 cards without English wording.

## Added in batches 50–57 (2026-10-12, Version 29)

- MARKERS / CLANS / ICONS (50–54): marker abilities (`VG.fx_mkab`), `tools/clan.txt` (Name<TAB>Clan from the official EN clan search, `~Clan` = conditional, `@icon` lines) → filters `cln cl1 clsv ico`; persona icon `pf:{ico,g}`; astral plane (`tg:["astralplane"]`, gauge kind `astral`).
- ARMS (52): zone `arms` (code `A`), card key `arm:{s:'L'|'R',f}` `armby:"name"`; step `arm me|it`; trigger `armd`; filters `arm arml armr`; cond `armw F` (my vanguard is armed with …).
- MUSIC / SONG (53): BanG Dream! normal orders → race `Music/<band>`; `putMusic`, `clearMusic` at end of turn (`musto`), step `sing`, trigger `sung`.
- BUDDYFIGHT (55–56): gauge kind `bf` (`gp n` pays, `gz:"bf"` on Gauge Zone, Dragon Ein `stup` trigger → `gzok bf`); BUDDY SOUL = gauge kind `bs` hosted by a unit or order (`gz:bs:me|it|h`, zone source `"bs"` in pk, count `["gzme","bs"]`, filters `bsn n` `bsf F` `bsx`, cond `bsh F`, cont from zone `Z` with `s.f.hostme`).
  Card keys `cc:[costs]` ([call cost], paid on the normal call from hand — `G.payCall`, cards paid "into this card's buddy soul" wait under it via `G.pendBS`) and `ctop:F` (call on top of a matching unit; that unit becomes the buddy soul). Step `ctop` (call the chosen card on top of this unit, no call cost — `G.callOnTop`).
  Mod `soulguard` (asked in `wouldLeave`). Link attack: step `link` (this unit + the units paid for cost 0) → `G.battle.link`, filter `lnk`, trigger `lnkd`. Impact: cost `fin` (declare final phase; sets `tf.fin<p>` and `fight.imp`), cond `noimp` `fin`, card key `np` (cannot be played), step `fatk it|vg` (the unit attacks the opponent's vanguard after the end-phase timing). `gzc` source `"top"` (top card of deck). Cond `oz F` (my order zone has …). ACT limit `l:"f"` = once per fight.
- OPERATE / PRODUCTS (57): `G.operate(iid,p,by)` (emits `operated`, tlog kind `operate`, `tf.opr<p>`); step `opr` (operate the chosen products, pick them with `["pk",["order"],1,0,{"rc":"product"}]`); triggers `oprd {ph,by,byf}` (this card is operated) and `uopr {f,ot}`; card key `oprby:F`.
  Step `asu {power,shield,crit,boost,intercept}`: call this order card to an open (RC) as a normal unit (`c.asU` gives the stats; dropped when it leaves the RC); follow with `["later","t",[["to","me","order"]]]` when it goes back.
- Fixed: the `gd` cost lost its `const mn` inside a comment (crash when a gauge was discarded with no min).
- NEXT: stride / G zone / generation break (67 lines; G units are rows without `jno`; needs a G deck in the builder, the stride step, hearts, face-up G zone count), special moves (Inazuma "when this attack is used"), over-soul, Monster Strike gacha, alchemagic, meteor, become/regarded, the 7 Buddyfight leftovers, then the 252 cards without English wording.

## Added in batches 58– (2026-10-12)

- STRIDE (patch 59–60, batch 58): G units = card-list rows of type X with grade 4 and a power (`def.gunit`, type `unit`); a deck may carry `g:[{no,n}]` (G deck, up to 16, at most 4 of a name; the deck editor lists G units and has a G ZONE group; `VG.inspectDeck` checks it). Zones `gzone` (face down until it has strode) and `heart`.
  Stride step after the ride phase (`G.strideStep` → `G.canStride`: both vanguards grade 3+ or this turn began with a grade 3+ vanguard, once a turn, a face-down G unit, hand grades ≥ 3 — `def.strideG3` from card key `sg3` counts as grade 3). `G.doStride(p, free)`: discard, the vanguard becomes the heart, G unit on (VC) (`c.heart`; power = printed + heart's printed power; it also has the heart's name for `nm`/`nh`). `G.unstride()` at the start of the end phase sends it back to the G zone face up and the heart back to (VC) (silently).
  A heart counts as on (VC) for its abilities (`inZone`, `activeCards`). Conds `gb n` (generation break: face-up G units in the G zone + a strode vanguard), `gzhas 'm'|'o' faceupOnly n`, `heartIs F`; count `gzu 'm'|'o'`; filter `gu` (is a G unit); triggers `strd {ph,f}` (your G unit strides) and `sdisc` (this card discarded for the stride cost; ability zone `D`); steps `sfree` (next stride is free) `stride` (stride now, free).
  Ritual N = `["cmp",["zf","drop",{"g":[1,1]}],">=",N]` (N or more grade 1 cards in drop).
- `G.chooseCards` with `max <= 0` returns [] (a "choose up to the counted number" with zero counted no longer asks).
- `move()` / fx `to`: the zone name `gzone` is not a gauge alias.
- Deferred on purpose: Inazuma special moves (special move zone rules unclear; the special move cards are outside the pool), the wrestling "when this attack is used" orders, dominate / hollow / lock-this-unit costs.
- OVER SOUL (batch 59): cost `osc F` (put a matching rear-guard into soul; sets `tf.os<p>`, emits `osSoul`), cond `osd`, trigger `ossoul` (zone S).
- METEORITES (59): filter `{"or":[{"rc":"meteorite"},{"tag":"meteorite"}]}`; cost `ozd n F min` (order zone → drop); mod `trigX2` (drive-check trigger effects twice).
- ALCHEMAGIC (60): `G.alchemagic` inside `playOrder` (normal orders; rule from vanguard card key `alc:{nm:same|diff|any, from:drop|bind}` or step `alcok`); the second order is bound (from drop), its cost paid, its effect run after; `tf.alcd<p>`, `G.alcNow` (cond `alcing`), cond `alcd`, `order` trigger `{alc:1}`, playOrder event `alc`; step `alcnosb`.
- MEMORY (61): zone `memory` (only <Quintuplet> stay; others go to drop), counts `memd` (different names) `memn`; card key `memord` (order zone counts as memory); steps `memo2` `win`; trigger `tstart` (beginning of your turn); `end {nohit:1}`.
- MONSTER STRIKE (62): zone `mbox` (code `MB`, ACTs from it), step `mbtop n`, cost `h2mb n`, rgc how `mbox`; pickup gacha card key `pug:{names,as}` (`G.aliasOf`: my cards with those names also carry the name `as` while it is in my order zone; filter `pug`); Gacha Redora gets the pickup ACTs.
- BRANDT GATE (63): bases / arenas / strategies are races (`rc`); SCOUT = gauge kind `scout` (`gz:scout`, trigger `gzd {me:1,gk:"scout"}`, ACTs in zone `Z`), STATION = gauge kind `station`, ATTACH = gauge kind `attach` hosted by the vanguard (`gz:attach:me`).
- LYRICAL (64): `tools/subtype.txt` gives Cursed Play (Truehearted Ruby, Everlasting Sapphire, Anathema Slap Twinkle, Cursed Sugar Sparkle, Wishing Your Happiness — a best guess from the card texts) and Magazine (Lyrical ShootingStarS, … Special Issue); friends = filter `frd`.
- RETRY / EXPLOSIVE GROWTH (patch 66): card key `retry:1` (`G.retry(iid)`: stand, +5000, `critSet:1` `driveSet:1`, once a turn, tlog kind `retry`, trigger `rtd {me,col}`), step `retry me|it|atk`, filter `rty`; card key `eg:F` adds a normal-call option on top of a matching rear-guard (it becomes gauge kind `growth`; placeRC event `od:"e"`), filter `egs` (in the Explosive Growth state). Mod `critSet`.
- Filters `ns` (non-sentinel, already there) `nrg` (no rear-guard of mine has this name); `persona` flag `personaPw` (persona ride +15000 only).
- WHOLE CARDS WITHOUT ENGLISH WORDING: `tools/hand-ast.txt` lines `@Card Name<TAB>{ast}` — `tools/mkdb.mjs` now compiles them even when the card has no English text (single-ability objects are wrapped into `a`). Written from the Japanese card text (`data/jp-text.json`, local only). Their races come from `tools/subtype.txt` (Japanese races translated, section "races of Japanese-only cards"). Fashion magic cards (Love and Berry) are vanilla set orders.


## Version 34 additions
- bf duration `n`: until the end of its owner's next turn (covers "cannot stand during your next stand phase").
- Row moves: mod `rowMove` (this unit may also swap along its row in the main phase), player effect `["pfx","rowMv","t"]` (all your rear-guards). Engine option `{a:'move', row:[k1,k2]}` for BL-BC, BC-BR, FL-FR.
- `["vg",{...}]` now also checks ico / cln / or / st / gle / tag / na / ty / tr through the card filter (vgX). Before V34 these keys were ignored.
- Triple Drive on the opponent's vanguard: `["cmp",["dr","ovg"],">=",3]`.
- Grimoire (Frieren) counted as set orders in the order zone: `["zf","order",{"ty":"so"}]` (best guess; no subtype in the card data).

## Version 35 additions
- Dominate: step `["dom",{m:{mods until end of turn}, ret:1}]` on the chosen opponent rear-guards (ctx.it): stands it, the dominating player picks one of the opponent's other units, the unit attacks it (no boost), dominate ends after that battle; `ret` retires it then. Engine `G.dominate(p, iid, {mods, ret})`.
- Triggers `domAtk` (a unit dominated by you attacks; group `attacker` = that unit) and `domHit`. tl/tlq queries take `dom:1` (only dominated attacks/hits), e.g. `["tl",{"k":"atk","s":"m","dom":1}]`.
- Cost `["gzup", n]`: turn n face-down G zone cards face up. Cond `hitV`: this battle's attack hit a vanguard.

## Version 36 additions
- Mods: `trigPw2` (power from your trigger effects doubled on this unit), `optStand` (you may leave it rested in your stand phase; asks), `hitUnlessSh: N` / `hitUnlessGr: N` (the attack hits regardless of power if the opponent's guardians' shield / grade total is below N).
- Costs: `["self","lock"]`, `["lockrg", n, F]`. Count `["tf","ccd"]` = times you counter-charged this turn.
- Card key `ronly: F` (crest in the crest zone: you cannot ride cards that do not match F).

## Version 39 additions
- Mushiking: unit tags `skillN`, `finishing attack:X`, `super finishing attack:Name` (compiled from the card lines). Filters `skmin`, `fin`, `sup`. Crest: `["orest",1,F]` cost then `["itpd",0],["useatk"]`; attack cards: trigger `atkUsed` (zone O), group `attacker`. Steps `retgt` (change the attacked unit to it; `"add"`: also battles it), `addvg`. Card keys `noso` (cannot play set orders), `ronly`.
- Inazuma special moves: row type `M` (def.type 'special', def.special). They live face down in the G zone (deck.g); they never stride / count for generation break. Card keys `smu: [{nh:[names], pos:'f'|'b'|'v', rc:'story'|'chronicle', tags:['forward',…]}]` (any one matches) and `smc: [conds]` (extra "can only be used if"). Step `usesm` (the ability's unit chooses and uses a face-down special move with grade ≤ your vanguard), `smup` (turn a face-down copy face up), `nogg` (opponent cannot guard with the chosen card's grade this battle), `ghand` (God Hand ticket). Trigger `smUsed` (zone GZ), `smFlip`. Groups `smu` (the user), `otgt` (opponent's attacked units). Filter `colt` (same column as the attacked unit). tlq `{k:'smuse', battle:1, usr:1}`.

## Version 40 additions
- Touken Ranbu training: card key `treq` (Training Equipment: ride-deck card; trainEq/rideDeckOK), step `trstart` (on `stup` from zone T), filter `trn` (a card conducting Training), step `kiwride` (after cost `["zc",1,{"trn":1},"order","soul"]` and `["itpd",0]`).
- Kiwame crests: key `kiw: [abilities]` — cards with your vanguard's name become grade 3 / 13000 / critical 1 / drive 2 / persona with only these abilities (engine G.def override). Use with `ronly: {snv:1}`.
- Key `sslock` (Seaside Camp restriction). Mod `g0guard` (opponent may only guard with grade 0 from hand).

## Version 41 additions
- Völundr: card key `vol: "<Man name>"` (the Valkyrie can be played from hand as an arms order onto a vanguard with that name; engine option `{a:'varm'}`), `volm: 1` (marker on the Man). Filter `vol` (has Völundr).
- Mod `icptMute` (during your turn, opponent's units moved RC→GC lose AUTO/CONT; engine c.fromRC + G.icptMuted).
- Card keys `callonly: F` (called to RC other than by F's ability → drop), `cmdeck: 1|"name"` (in the deck: counts as crimson moon), `g12deck: "name"` (in the deck: also grade 1 and 2), `udeck: 1` (an order that can be searched as a unit card), `h2o: 1` (would go to hand → order zone), `c2h: 1` (called from deck → hand).
- Steps `egon [zones] upTo` (Explosive Growth a hand/drop card onto the chosen rear-guard, as stand), `egsplit` (leave the growth factor on the circle as rest, this unit to hand).

## Version 42 additions (rules from the Japanese official card pages and Q&A)
- D-Legion (D-双闘): step `["dlegion", name | [names]]` on an ACT (z V, cond `["candl"]`). Once a fight, opponent's vanguard grade 3+: 4 cards from drop back to deck (≤2 trigger units, no heal/over), the named card from deck becomes the legion mate (circles.V2, zone VC pos V2). Leader + mate rest together, the leader's attack adds the mate's power, the mate's "when this unit attacks" also fires, the mate goes to soul when the leader leaves, no persona ride while legioned. Conds `dleg` (in D-legion), `dlegd` (D-legioned this turn). Trigger `dlpl` (this card placed by D-legion).
- Alchemix (魔獣合成): step `["alcx", F]` — choose rear-guards matching F with different names; if 2+, stack them under an Ubermensch token (gauge kind `alcx`, hosted by the token); ctx.it = the token. Triggers `alcxd` (zone Z: this card was alchemixed; `["itev","host"]` = the token), `alcxh` (this unit alchemixed), `ualcx` (you alchemix). Step `tofront`.
- Formula count: card key `cpx` (C+P=X on the vanguard: each call / order played in your main phase gives +1 until end of opponent's next turn). Count `["formula"]`, step `["fplus", n]`.

## Version 43 additions
- Cond `["stw", state]` (c.stWas: the state the card was in when it left the field).
- Special moves: def.smOff — a front-row usage condition makes the move a Shoot, otherwise Offence (Japanese official pages); trigger smFlip passes t.off.
- Steps `guessg` (guess a grade, then reveal), `vswap` (G.swapVR(p, rid): a rear-guard and the vanguard swap circles; s[2]='rest' rests it).
- Card key `dbl: {k, c, v, m}` — when this card would be retired (`retire`) / put into soul from RC (`soul`) / discarded (`disc`) / soul blasted (`sb`) for a cost, it may count as two cards. `c` = conditions (judged from this card), `v` = the paying card must be your vanguard matching this filter, `m` = the paying card must match this filter. Engine G.dblCan / G.dblChoose (asks which double cards to use, then the rest).
- Card keys `cnt2: {z, rc}` (counted as two cards when a count of that race is made in that zone), `pd2: 1` (counts as two when your vanguard's ability counts the cards its cost took; count `pd`), `u2: "name"` (counted as two units by `["u",…]` counts of abilities of cards with that name), `sg0: 1` (in soul, may be chosen as grade 0 for your vanguard's ability). dbl kind `rvh` = revealed from hand for a cost.
- Step `alccb n` (the next alchemagic this turn costs counter-blast n less; pushes a cbl entry when alchemagic is chosen).
- Malefics: step `asset` (ctx.it cards in the order zone count as set orders for the fight: c.asSetX, cleared when leaving the order zone), `malg [zones that draw]` (trigger card from deck/hand/drop as face-up gauge kind `mal` of ctx.it[0]), `trset N F count` (drive/damage-check triggers sharing an icon with those cards' gauges give +N until end of opponent's next turn; P.effects trigSet). Zone `VO` = VC or order zone.
- [Event] (Japanese official Q8299): key `evn: {names, as}` (alias like pickup gacha + event) or `event: 1`; rule: two or more event cards in the order zone → the newest stays, others to drop. Filter `evt`.

## Version 44 additions
- tools/rowfix.txt: `name<TAB>family<TAB>deck limit` overrides a row (v = no ability) — facts checked on the Japanese official pages. db.js prints the deck-limit line when the limit is above 4.
- Steps `ncd` (no calls from drop this turn), `dmgless n` (effect damage to your vanguard -n until end of opponent's next turn; `dmg` honours it), `bsdrop` (chosen cards' buddy souls to drop), `npm` (this fight: cannot play that name in your main phase), `obindh` / `oreth` (opponent binds a hand card face down, remembered by this card / gets it back), `swaphm` (swap a hand card and a Monster BOX card), `pcf` (both reveal top 3 → bottom; higher grade total draws).
- Mods `atk3` (does not rest when attacking, up to three attacks this turn), `noShoot` (cannot use shoot special moves). Cond `gfirst` (the guardian placed first in this battle; engine guard events carry gfirst). Trigger `leave` takes `row`. Zones `SD` (soul or drop).
- tags: `overdrive`, `ritual`, `event` (tag event also sets def.event).

## Version 45 additions
- Monster Strike grade 4: ACT z MB with conds `["cmp",["tl",{"k":"mv","s":"m","to":"VC","ride":1,"rfg":3}],"==",0]` (and rfg 4), effect `["ride","me"]`. Strike Shot: `["tfset","sshot"]` (+ `sshot4` when `["pdIs",0,{"g":[4,4]}]`), read with `["tf","sshot"]`.
- Mods `callBounceN` (vanguard: a normal non-sentinel unit replaced by this unit's call returns to hand), `overPw` (vanguard: a different-name unit called over another by the vanguard's ability gets that unit's original power). `driveSet: 0` is honoured. Step `oallbot` (opponent's front-row rear-guards to the bottom of their deck, in their order).

## Version 46 additions
- Cost `["td", n]` (top n cards of your deck into your damage zone).
- Card keys `dropSave: F` (in drop: when your rear-guard matching F would leave RC by an effect, you may bind this card and it stays), `ozOne: 1` (only one card of this name in your order zone; the newest stays).

## Version 47 additions
- Filters `ssk` (has spirit strike: a hit-a-rear-guard → damage ability), `nnh2` (second excluded name part). Step `osb1` (opponent puts a card of their choice from soul into drop).
- Card key `ozCallF: F` (in the order zone: you can call only units matching F to RC — normal calls and ability calls).

## Version 48 additions
- Ability tag `versionup` = [Version Up] / 開眼: mkAbility adds the condition persona-rode-this-turn or 4+ damage (Japanese official Q10899).
- Card keys `retryc: [conds]` (has [Retry] only while the conditions hold), `gcWith: {f, c}` (when this unit is moved RC→GC, same-column rear-guards matching f may go too), `rv3: 1` (revealed from hand as grade 3 for costs), `discOrd: 1` (discarded as an order card for ['disc', n, {ty:'o'}] costs).
- Count `["vcn"]` (cards on VC). Mods `atkAllRG` (attacking a rear-guard battles every rear-guard), `asTU` (regarded as a trigger unit). Step `togc` (chosen rear-guards to GC during a battle).

## Version 49 additions
- Steps `less {kind: disc|rem|sb, nm | it, n, keep}`, `pkx {nm | it, zone (drop/field/...), to}` (a single choice becomes up to `to`), `cset type [costs]` (chosen unit's original AUTO/ACT costs replaced this turn; engine abs()), `or2 name` (that card's `or` performs both), `nofs` (fight: no FantômeSkill costs for this name), `markrb` / `riderb` (remember the card bound for the cost; ride it back as rest).
- Card keys `alias {names, as}` (order zone alias, no gacha text), `noRestNm` (order zone: cannot rest that name), `deckAs {vg, as}` (in deck: also named `as` while the vanguard matches), `rcSave F` (RC: retire this instead so a matching unit stays), `dname` (in soul: each copy counts as a different name for `zd`). `og: 0` allowed.

## Version 50 additions
- Card keys `dressDrop`, `dressDropDB`, `look1`, `discLess {nm, vg}`, `atkBackCol`, `overHand`, `handDbl`, `callNa`, `dropG {vg, g}`, `trigAdd {c, d}`, `soulNames {vg, nh}`, `raceDeck {vg, rc}`, `nuDeck {by}`, `deckAs.any`.
- Filter `pbyf` (placed this turn by the ability of a card matching F). Steps `gcas shield bind?`, `mgc`, `xtgt` (after choosing an opponent rear-guard), `musto`. Trigger `disc` option `sdisc` (discarded for a stride cost). G.aliasOf may return several names.

## Version 51 additions
- Card keys `dressGrant [abilities]`, `strideAlt`, `mkPw`, `atkTax`. Steps `vgc4`, `swapsg`, `nooc`. Trigger `opwdn {byf}` (opponent rear-guard's power reduced by your card), `vplace.ride`, `chosen.abt` (act/auto; cards chosen from drop by pk also emit chosen). Zone key `units` for zoneCards.

## Version 52 additions
- Steps `rtsg`, `pwmatch`, `pw0`, `ngg`, `swapsg`. Triggers `agstart`, `dstep`. Mods `noAct`, `driveBottom`, `gcNoHit`. `dom` option `bot`. zc `{distg:1, wild:"name part"}`.

## Version 53 additions
- Card key `mate: "name"` (Mate Unit: cannot ride; call/guard only with that vanguard). Filter `bud` (buddy monster). Cost `["bsd", n]`. `less` kind `eb`. tf `carry` (next ride keeps trigger mods). Mod `gbAny`. Steps `pkg1` (G.fxv.g1 = chosen grade + 1, filter gvar), `omvf`.

## Version 54 additions
- Mods `guardNs`, `guardDg` (with guardMin: only non-sentinels count / grades must differ), `ominaB`, `ocritSh`, `trigNuP`, `bindNm "part"`, `dcLook2`. pfx keys `noTrigPwB`, `jailNa`, `personaBack` (hasFlag now also reads player effects).
- Cost `["ofd", F]` (turn any number of face-up order zone cards face down; paid = those cards), `["dhand"]` (discard whole hand, 1+). Steps `itfu` (turn chosen face-down cards face up), `noautok`, `loseg`. Count `["ofdv", "name part", g]`, `["chby", F, zone]`.
- Trigger `sbme {by:'v'}` (this card soul-blasted for a cost; use z D). Filter `ntlos`. ACT key `lk` (shared once-per-turn group).
- Card keys `dvFrom "name"`, `gzAbs {gk, tag}`, `absFrom {nm, z, ty, my, one, alt}`, `vgBlank`, `noRideMy`. XTOK `almajest celestage`.

## Version 55 additions (100%)
- Steps `ridebv`, `oputvc`, `oreride`, `del`, `trigact`, `asname [dur]`, `gabnull`, `gabget "name"`, `actauto`, `ncont`, `srfm`, `gleipcall`, `srarm F paidIdx`, `copyab dur type`, `fatk "dom"`. Costs `["trio", [names]]`, `["bsdeck"]`; `gp`/`td` honour Rune Staff (gsLess).
- Counts `["colpw", F]`. Conds `dvcr F`, `nsnret`, `nbtl {f, from, to}`. Triggers `ustood {wf, own}`, `rtd` takes `wf`. powerUp event carries `n`.
- Mods `nullAb`, `noDblSt`. pfx `rideTax`, `noAutoP`.
- Card keys `secretSword`, `mbAny`, `ozShield {nm, vg, rg, sh}`, `ozTrig {nm, vg, rg, crit}`, `xod2`, `saien {vg, nh, tk}`, `gsLess`, `gleip`, `race2`, `bsStay3`, `bsToDeck`, `noSG`, `frozenStars`. XTOK `demon wolf, fenrir` (crit field supported).

## Version 67 additions (G units)
- Card key `scost: F` — this G unit's stride cost is "discard one card matching F from hand" (engine `G.strideCostOk`, `doStride`). `strideIf` already existed.
- Dominate `["dom",{tgt:'v'|'r', vc:1, m, ret}]`: must attack the vanguard / a rear-guard; `vc` lets a vanguard be dominated. Mod pair `{driveSet:1, rgDrive:1}` = "its drive becomes 1 and it performs drive checks".
- `["xturn",{skipR:1,noStr:1}]` — additional turn without the ride phase / without stride.
- Choose `{"s":"x","k":"lk"}` = locked cards (of either player) — use with `["unlock"]`; group `itg {s,k:'lk'}` too.
- Cost `["rrgd", n, F]` — retire 1 to n rear-guards with different card names (`pd i` = how many).
- Tags made by mkdb from the card itself: `ritual` (text "Ritual N" or a Ritual condition), `hollow` (has the hollow state step) → filters `{"tag":"ritual"}` / `{"tag":"hollow"}`.
- Lines with `[generation break N]` or `ritual N` in the header: the header is not read; write `t`, `z`, `l` in the entry.
- `node tools/gl.mjs <card regexp>` lists the unreadable lines of cards outside the Japanese pool.

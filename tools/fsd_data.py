# Rebuild data/fsd.json from a research file: python3 tools/fsd_data.py <research.json>
# Keeps the research verbatim under "research" and derives a flat "releases" timeline from it (no new facts).
import json, sys
r=json.load(open(sys.argv[1]))
r.pop('do_not_touch',None)
t=r['tracks']; hw4=t['hw4_ai4']; hw3=t['hw3_ai3']; ct=t['cybertruck']; semi=t['tesla_semi']
NATA='https://www.notateslaapp.com/software-updates/version/%s/release-notes'
TS='https://teslascope.com/software/full-self-driving'
rel=[]
def add(**k): rel.append(k)
mp={m['fsd_version']:m for m in hw4['major_point_releases']}
add(v='15.0.1',fw='2026.38.6.11',date='2026-11-21',tracks=['hw4'],kind='release',fleet='HW4 Model Y, US only (first wave)',
    text='First consumer v15. Upgraded end-to-end network and vision encoder, Reality View, learned trip start and end navigation, pothole and debris detection, Bike Rack Mode. Supervised.',
    src=[hw4['latest']['sources'][0]['url'],NATA%'2026.38.6.11','https://teslascope.com/software/2026.38.6.11',hw4['latest']['sources'][4]['url']])
add(v='15 wide release',fw=None,date='2026-12',tracks=['hw4'],kind='planned',fleet='HW4 fleet (target)',
    text='Musk: "FSD V15 goes to wide release next month." He said yes when asked if it comes with the 2026 Holiday Update. A stated target, not a completed release.',
    src=hw4['latest']['wide_release_plan']['sources'])
add(v='14.3.13',fw='2026.44.1',date='2026-11-16',tracks=['hw4','ct'],kind='release',fleet='Broad HW4 fleet incl. Cybertruck; HW3 gets v14.3 Lite on the same firmware',
    text='The broad 2026.44 update carries v14.3.13 to HW4 cars (TeslaFi sample on Not a Tesla App: 5,373 cars, 43.6%). Teslascope logged Cybertruck installs on 21 Nov 2026. Its notes list Automatic Collision Evasion for New S, 3, New X, Y and CT.',
    src=['https://teslascope.com/software/2026.44.1',NATA%'2026.44.1','https://www.notateslaapp.com/news/5054/tesla-update-202644-brings-fsd-v143-and-v143-lite-to-every-owner',ct['latest']['source_history']])
m=mp['14.3.13']
add(v='14.3.13',fw=m['firmware'],date=m['date'],tracks=['hw4','ct'],kind='release',fleet='HW4, incl. Cybertruck',
    text='Latest v14.3 point release: upgraded RL training and vision encoder, MLIR rewrite with 20% faster reactions, parking improvements, emergency vehicle, school bus and traffic light work, unified Summon/FSD/Robotaxi model.',
    src=[m['source'],m['source_notes']])
m=mp['14.3.4']
add(v='14.3.4',fw=m['firmware'],date=m['date'],tracks=['hw4','ct'],kind='release',fleet='HW4, incl. Cybertruck',
    text='Parking options shown on the map at the destination. Actually Smart Summon and Dumb Summon arrive on Cybertruck, which also gets the unified Summon/FSD/Robotaxi model in this build.',
    src=[m['source'],ct['feature_parity_and_gaps']['actually_smart_summon']['first_confirmed']['source_article']])
m=mp['14.3.3']
add(v='14.3.3',fw='2026.14.6.7',date='2026-06-02',tracks=['hw4'],kind='release',fleet='HW4 (S/3/X/Y)',
    text='Actually Smart Summon max speed raised to 8 mph (13 km/h), not on Cybertruck. Intervention-free distance and streak in the Self-Driving app. Also on 2026.16.6 (18 Jun 2026).',
    src=[m['source'],m['source_notes']])
m=mp['14.3.2']
add(v='14.3.2',fw=m['firmware'],date=m['date'],tracks=['hw4'],kind='release',fleet='HW4 (S/3/X/Y)',
    text='Unified model between Actually Smart Summon, FSD and Robotaxi, plus a prompt asking why you intervened.',src=[m['source'],m['source_notes']])
m=mp['14.3']
add(v='14.3',fw=m['firmware'],date=m['date'],tracks=['hw4'],kind='release',fleet='HW4',text='First FSD v14.3 release on HW4.',src=[m['source'],m['source_article']])
m=mp['14.2']
add(v='14.2',fw=m['firmware'],date=m['date'],tracks=['hw4'],kind='release',fleet='HW4',text='First FSD v14.2 build listed on Teslascope.',src=[m['source']])
m=mp['14.1.1']
add(v='14.1.1',fw=m['firmware'],date=m['date'],tracks=['hw4'],kind='release',fleet='HW4',text='Early v14.1 point release. v14.1.2 listed the same day on 2025.32.8.10.',src=[m['source']])
L=hw3['latest']
add(v='14.3 Lite',fw='2026.33.5',date='2026-10-06',tracks=['hw3'],kind='release',fleet='HW3 (S/3/X/Y)',
    text='HW4 v14 intelligence distilled into HW3. Adds parking, unparking and reversing, Arrival Options, Speed Profiles incl. a new SLOTH mode, and Start Self-Driving from Park. Now on the broad 2026.44.1 too.',
    src=L['sources'])
add(v='14.2 Lite',fw='2026.27.6',date='2026-09-08',tracks=['hw3'],kind='release',fleet='HW3',text='Teslascope lists 14.2 Lite on 2026.27.6 (8 Sep), 2026.27.10 (18 Sep), 2026.27.11 (22 Sep) and 2026.38.4.5 (9 Nov 2026).',src=[TS])
add(v='14.1 Lite',fw='2026.21.6',date='2026-08-08',tracks=['hw3'],kind='release',fleet='HW3',text='Also on 2026.26.6.5 (25 Aug 2026).',src=[TS])
m=hw3['earlier_lite_and_v12_milestones'][2]
add(v='14 Lite',fw='2026.20.5.1',date='2026-06-28',tracks=['hw3'],kind='release',fleet='HW3 (early access, wider from 21 Jul on 2026.20.6.11)',text='First v14 for HW3. Early access in late June, wider rollout with 2026.20.6.11 in July.',src=m['sources'])
add(v='12.6.4',fw='2026.8',date='2026-03-12',tracks=['hw3'],kind='release',fleet='HW3',text='Last v12.6 family before the v14 Lite branch. Also on 2026.8.3 (18 Mar) and 2026.8.6 (1 Apr 2026).',src=[TS])
add(v='12.6.3',fw='2024.45.32.15',date='2025-02-07',tracks=['hw3'],kind='release',fleet='HW3',text='Listed on Teslascope.',src=[TS])
u=hw3['hardware_upgrade_or_retrofit']['unsupervised_on_hw3']
add(v='HW3 ceiling',fw=None,date=u['date'],tracks=['hw3'],kind='event',fleet='HW3',
    text='Q1 2026 earnings call: Musk says HW3 cannot reach unsupervised FSD (one-eighth the memory bandwidth of HW4). A discounted AI4 trade-in or a computer-plus-cameras retrofit was offered in principle; no price or date yet.',src=u['sources'])
c=semi['confirmed']; p=semi['planned_or_unconfirmed']['musk_q2_2026_earnings']
add(v='Semi volume production',fw=None,date=c['production']['event_date'],tracks=['semi'],kind='event',fleet='Tesla Semi',
    text='Sparks, Nevada factory opens; Tesla says high-volume production and deliveries start now, with capacity designed for 50,000 trucks a year. Every deployed Semi is human-driven.',src=c['production']['sources']+c['operation_today']['sources'][:1])
add(v='Electric steering',fw=None,date='2026-09-25',tracks=['semi'],kind='event',fleet='Tesla Semi',
    text='Official @tesla_semi: the first heavy-duty truck with electric steering, which "also lays the groundwork for future autonomy." Future capability, not FSD today.',src=[c['electric_steering_and_future_autonomy']['url']])
add(v='Semi autonomy plan',fw=None,date=c['priestley_iaa_2026']['date'],tracks=['semi'],kind='event',fleet='Tesla Semi',
    text='Semi chief Dan Priestley at IAA: driver assistance and safety features first, human-driven trucks gather training data, no date for full autonomy.',src=c['priestley_iaa_2026']['sources'])
add(v='Semi self-driving target',fw=None,date=p['date'],tracks=['semi'],kind='planned',fleet='Tesla Semi (roadmap)',
    text='Q2 2026 call: Musk said Semi self-driving should start "working" around the end of 2026 or early 2027. A development target, not a customer release.',src=p['sources'])
out={'checkedAt':'2026-11-27','about':r['disclaimer'],'releases':rel,'research':r}
json.dump(out,open('data/fsd.json','w'),indent=1,ensure_ascii=False)
print(len(rel),'releases')

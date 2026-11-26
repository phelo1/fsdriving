# Which Tesla titles the tracker counts.
# FLEET (the original tracker, US only): 'supervisor' is the headline role; 'specialist' and 'operations' are the
#   related fleet roles. History, the S-curve, the OG card and the hiring-to-launch stats use FLEET only.
# 'other': any other US title with "Robotaxi" in it (service techs, market leads, charging, engineering, product...).
# 'selfdriving': self-driving test / data-collection operator roles, any country. NOT Robotaxi jobs; a separate,
#   opt-in map layer. Title-based: vehicle operators, self-driving data collection supervisors/operators, test specialists.
import re
FLEET = ('supervisor', 'specialist', 'operations')
ROBOTAXI = FLEET + ('other',)
_SD = re.compile(r'vehicle operator|data collection (supervisor|operator)\b.*self[- ]?driving|test specialist, self-driving', re.I)

def classify(title):
    t = title.lower()
    if 'robotaxi fleet support' in t and 'supervisor' in t: return 'supervisor'
    if 'robotaxi fleet support' in t: return 'specialist'
    if 'robotaxi operations advisor' in t or 'robotaxi operations manager' in t: return 'operations'
    if 'robotaxi' in t: return 'other'
    if 'optimus' not in t and _SD.search(title): return 'selfdriving'
    return None

def us_only(cat):
    return cat in ROBOTAXI

def subgroup(title):
    """Display sub-group for 'other' Robotaxi roles."""
    t = title.lower()
    if re.search(r'service technician|charging|attendant|technician', t): return 'Service & charging'
    if re.search(r'market|operations|program manager|hr |partner|public safety|content|video|visual designer|intern', t): return 'Market, ops & business'
    return 'Engineering & product'

def locations(state):
    """location id -> (country code, state code or '', state/region name, city). Covers US states and other countries."""
    loc = {}
    for reg in state['geo']:
        for site in reg['sites']:
            for s in site.get('states', []) or []:
                for city, ids in s.get('cities', {}).items():
                    for i in ids: loc[i] = (site['id'], s['id'], s['name'], city)
            for city, ids in (site.get('cities') or {}).items():
                for i in ids: loc.setdefault(i, (site['id'], '', '', city))
    return loc

# Tesla sometimes names a city in its local script; show an English name (the raw name stays in the job record).
CITY_ALIAS = {'부산광역시': 'Busan', 'Mumbai Suburban': 'Mumbai'}
COUNTRY = {'AU': 'Australia', 'CZ': 'Czechia', 'ES': 'Spain', 'FR': 'France', 'GB': 'United Kingdom', 'HK': 'Hong Kong',
           'IL': 'Israel', 'IN': 'India', 'KR': 'South Korea', 'NZ': 'New Zealand', 'PL': 'Poland', 'SG': 'Singapore',
           'DE': 'Germany', 'JP': 'Japan', 'CA': 'Canada', 'CN': 'China', 'NL': 'Netherlands', 'NO': 'Norway', 'IT': 'Italy',
           'AE': 'United Arab Emirates', 'TW': 'Taiwan', 'TH': 'Thailand', 'MX': 'Mexico', 'SE': 'Sweden', 'CH': 'Switzerland',
           'US': 'United States'}

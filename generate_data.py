"""
Generate js/co2data.js from the Our World in Data CO2 dataset.

Usage:
    python generate_data.py [path/to/owid-co2-data.csv] [--year 2024] [--force]

Download the CSV from https://github.com/owid/co2-data and pass its path
(default: ./owid-co2-data.csv). Without --year the newest complete year in
the file is used.

The file is only rewritten when the data differs from what is there, and
never with an older year or far fewer countries (unless --force). The
workflow in .github/workflows/data.yml runs this on a schedule.

The script writes ONLY generated data: CO2_DATA, WORLD_TOTALS and DATA_META.
Everything maintained by hand lives elsewhere and is never touched:
    js/config.js   territory mappings and the Paris budget assumptions
    js/metrics.js  the calculations built on top of the data
"""
import argparse
import csv
import datetime
import hashlib
import json
import logging
import os
import re
import sys

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
log = logging.getLogger(__name__)

OUTPUT_PATH = 'js/co2data.js'
BUDGET_BASE_YEAR = 2020   # the IPCC budgets count from here (BUDGET_BASE_YEAR in js/config.js)
MIN_COUNTRIES = 150   # fewer than this means the file or the matching is broken
SOURCE_URL = 'https://github.com/owid/co2-data'

# ISO 3166-1 alpha-3 to numeric mapping (matching the world-atlas TopoJSON ids)
ISO_A3_TO_NUM = {
    'AFG':'004','ALB':'008','DZA':'012','ASM':'016','AND':'020','AGO':'024','ATG':'028',
    'ARG':'032','ARM':'051','AUS':'036','AUT':'040','AZE':'031','BHS':'044','BHR':'048',
    'BGD':'050','BRB':'052','BLR':'112','BEL':'056','BLZ':'084','BEN':'204','BMU':'060',
    'BTN':'064','BOL':'068','BIH':'070','BWA':'072','BRA':'076','BRN':'096','BGR':'100',
    'BFA':'854','BDI':'108','KHM':'116','CMR':'120','CAN':'124','CPV':'132','CAF':'140',
    'TCD':'148','CHL':'152','CHN':'156','COL':'170','COM':'174','COG':'178','COD':'180',
    'CRI':'188','CIV':'384','HRV':'191','CUB':'192','CYP':'196','CZE':'203','DNK':'208',
    'DJI':'262','DMA':'212','DOM':'214','ECU':'218','EGY':'818','SLV':'222','GNQ':'226',
    'ERI':'232','EST':'233','SWZ':'748','ETH':'231','FJI':'242','FIN':'246','FRA':'250',
    'GAB':'266','GMB':'270','GEO':'268','DEU':'276','GHA':'288','GRC':'300','GRL':'304',
    'GTM':'320','GIN':'324','GNB':'624','GUY':'328','HTI':'332','HND':'340','HUN':'348',
    'ISL':'352','IND':'356','IDN':'360','IRN':'364','IRQ':'368','IRL':'372','ISR':'376',
    'ITA':'380','JAM':'388','JPN':'392','JOR':'400','KAZ':'398','KEN':'404','KIR':'296',
    'KWT':'414','KGZ':'417','LAO':'418','LVA':'428','LBN':'422','LSO':'426','LBR':'430',
    'LBY':'434','LTU':'440','LUX':'442','MDG':'450','MWI':'454','MYS':'458','MDV':'462',
    'MLI':'466','MLT':'470','MRT':'478','MUS':'480','MEX':'484','MDA':'498','MNG':'496',
    'MNE':'499','MAR':'504','MOZ':'508','MMR':'104','NAM':'516','NPL':'524','NLD':'528',
    'NZL':'554','NIC':'558','NER':'562','NGA':'566','PRK':'408','MKD':'807','NOR':'578',
    'OMN':'512','PAK':'586','PAN':'591','PNG':'598','PRY':'600','PER':'604','PHL':'608',
    'POL':'616','PRT':'620','QAT':'634','ROU':'642','RUS':'643','RWA':'646','SAU':'682',
    'SEN':'686','SRB':'688','SLE':'694','SGP':'702','SVK':'703','SVN':'705','SLB':'090',
    'SOM':'706','ZAF':'710','KOR':'410','SSD':'728','ESP':'724','LKA':'144','SDN':'729',
    'SUR':'740','SWE':'752','CHE':'756','SYR':'760','TWN':'158','TJK':'762','TZA':'834',
    'THA':'764','TLS':'626','TGO':'768','TTO':'780','TUN':'788','TUR':'792','TKM':'795',
    'UGA':'800','UKR':'804','ARE':'784','GBR':'826','USA':'840','URY':'858','UZB':'860',
    'VUT':'548','VEN':'862','VNM':'704','YEM':'887','ZMB':'894','ZWE':'716',
    'PSE':'275','NCL':'540','CUW':'531','ABW':'533','PYF':'258','FSM':'583',
    'BES':'535','SXM':'534','MAF':'663','SPM':'666','WLF':'876','MYT':'175',
    'SHN':'654','FLK':'238','GIB':'292','FRO':'234','CYM':'136',
    'VIR':'850','GUM':'316','MNP':'580','PRI':'630','TCA':'796','VGB':'092',
    'AIA':'660','MSR':'500','COK':'184','NIU':'570','TKL':'772',
    'WSM':'882','TON':'776','PLW':'585','MHL':'584','NRU':'520','TUV':'798',
    'KNA':'659','LCA':'662','VCT':'670','GRD':'308',
    'HKG':'344','MAC':'446','LIE':'438','MCO':'492','SMR':'674','STP':'678','SYC':'690',
    # OWID uses its own code for Kosovo. The world-atlas shape has no numeric
    # id, so the app identifies it by name.
    'OWID_KOS': 'Kosovo',
}

# OWID_ codes that are real places rather than aggregates
OWID_COUNTRY_CODES = {'OWID_KOS'}

FIELDS = ('population', 'co2', 'consumption_co2', 'cumulative_co2')


def safe_float(val):
    """Convert a CSV cell to float; empty or invalid cells become None."""
    if val is None or val.strip() == '':
        return None
    try:
        return float(val)
    except ValueError:
        return None


def sha256_of(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def read_rows(csv_path, years, world_years):
    """Return ({(iso, year): row}, {year: world_row}): countries for `years`,
    the World row for `world_years`."""
    rows, world = {}, {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            year = row.get('year', '').strip()
            iso = row.get('iso_code', '').strip()
            country = row.get('country', '').strip()
            if country == 'World':
                if year in world_years:
                    world[year] = row
                continue
            if year not in years:
                continue
            if not iso:
                continue  # continents, income groups and other aggregates
            if iso.startswith('OWID_') and iso not in OWID_COUNTRY_CODES:
                continue
            rows[(iso, year)] = row
    return rows, world


def latest_complete_year(csv_path):
    """The newest year with a World total and emissions for most countries."""
    world, countries = set(), {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if not safe_float(row.get('co2')):
                continue
            year = row.get('year', '').strip()
            if row.get('country', '').strip() == 'World':
                if safe_float(row.get('population')):
                    world.add(year)
            elif row.get('iso_code', '').strip():
                countries[year] = countries.get(year, 0) + 1
    complete = [int(y) for y in world if countries.get(y, 0) >= MIN_COUNTRIES]
    if not complete:
        raise ValueError('No year in the CSV has a World total and enough countries')
    return max(complete)


def read_existing(path):
    """(meta, countries, world_totals) of the data file in place, or None."""
    try:
        text = open(path, 'r', encoding='utf-8').read()
        meta = json.loads(re.search(r'^const DATA_META = (.*);$', text, re.M).group(1))
        world_totals = json.loads(re.search(r'^const WORLD_TOTALS = (.*);$', text, re.M).group(1))
        body = re.search(r'^const CO2_DATA = \{\n(.*?)\n\};$', text, re.M | re.S).group(1)
        countries = json.loads('{' + body.rstrip().rstrip(',') + '}')
        return meta, countries, world_totals
    except (OSError, AttributeError, ValueError):
        return None


def latest_value(rows, iso, field, years):
    """Newest available value of one field, looking back year by year."""
    for year in years:
        row = rows.get((iso, year))
        if row:
            value = safe_float(row.get(field))
            if value is not None:
                return value
    return None


def build_countries(rows, years):
    countries, unmatched = {}, []
    for iso in sorted({iso for iso, _ in rows}):
        key = ISO_A3_TO_NUM.get(iso)
        if not key:
            unmatched.append(iso)
            continue
        name = next(rows[(iso, y)]['country'] for y in years if (iso, y) in rows)
        pop = latest_value(rows, iso, 'population', years)
        co2 = latest_value(rows, iso, 'co2', years)
        cons = latest_value(rows, iso, 'consumption_co2', years)
        hist = latest_value(rows, iso, 'cumulative_co2', years)
        if pop is None and co2 is None:
            continue
        countries[key] = {
            'name': name,
            'pop': round(pop / 1e6, 3) if pop else None,          # millions
            'co2': round(co2, 3) if co2 is not None else None,     # Mt
            'cons': round(cons, 3) if cons is not None else None,  # Mt
            'hist': round(hist / 1000, 3) if hist is not None else None,  # Gt
        }
    return countries, unmatched


def build_world_totals(world, year):
    row = world.get(year)
    if not row:
        raise ValueError(f"No 'World' row for {year} in the CSV")
    pop = safe_float(row.get('population'))
    co2 = safe_float(row.get('co2'))
    hist = safe_float(row.get('cumulative_co2'))
    missing = [n for n, v in (('population', pop), ('co2', co2), ('cumulative_co2', hist)) if not v]
    if missing:
        raise ValueError(f"World row for {year} is missing: {', '.join(missing)}")
    # Globally, consumption equals production; OWID leaves the cell empty
    # in some releases.
    cons = safe_float(row.get('consumption_co2')) or co2

    # What the world has emitted since the IPCC budgets started counting,
    # up to and including the data year. The site subtracts this from them.
    emitted = 0
    for y in range(BUDGET_BASE_YEAR, int(year) + 1):
        value = safe_float(world.get(str(y), {}).get('co2'))
        if not value:
            raise ValueError(f'World row for {y} has no co2 value')
        emitted += value

    return {
        'pop': round(pop / 1e6, 3),
        'co2': round(co2, 3),
        'cons': round(cons, 3),
        'hist': round(hist / 1000, 3),
        'emittedSince2020': round(emitted / 1000, 1),
    }


def render_js(countries, world_totals, meta):
    """Render the data file. Values are JSON, so any name is escaped safely."""
    dump = lambda value: json.dumps(value, ensure_ascii=False)
    lines = [
        '// GENERATED FILE. Do not edit by hand; run `python generate_data.py` instead.',
        '//',
        '// CO2 emissions data from Our World in Data (Global Carbon Project)',
        f'// Source: {SOURCE_URL}',
        '//',
        '// Units:',
        '//   pop  = population in millions',
        '//   co2  = territorial CO2 emissions in Mt (million tonnes)',
        '//   cons = consumption-based CO2 emissions in Mt (null if unavailable)',
        '//   hist = cumulative CO2 emissions since 1750 in Gt (gigatonnes)',
        '//   emittedSince2020 = world CO2 emissions from 2020 to the data year in Gt',
        '//',
        '// Each value is the newest one available up to the data year.',
        '// WORLD_TOTALS is the OWID "World" row. It includes international aviation',
        '// and shipping, which are not attributed to any country.',
        '',
        f'const DATA_META = {dump(meta)};',
        '',
        'const CO2_DATA = {',
    ]
    for key in sorted(countries):
        lines.append(f'  {dump(key)}: {dump(countries[key])},')
    lines += [
        '};',
        '',
        f'const WORLD_TOTALS = {dump(world_totals)};',
        '',
    ]
    return '\n'.join(lines)


def validate(countries, world_totals):
    errors = []
    if len(countries) < MIN_COUNTRIES:
        errors.append(f'Only {len(countries)} countries matched (expected {MIN_COUNTRIES}+)')
    for key, label in (('840', 'USA'), ('156', 'China'), ('356', 'India')):
        if key not in countries:
            errors.append(f'Missing major country: {label} ({key})')
        elif countries[key]['co2'] is None:
            errors.append(f'Missing CO2 data for {label}')
    country_sum = sum(c['co2'] or 0 for c in countries.values())
    if not 0.85 * world_totals['co2'] <= country_sum <= 1.02 * world_totals['co2']:
        errors.append(
            f"Country emissions add up to {country_sum:.0f} Mt, "
            f"but the world total is {world_totals['co2']:.0f} Mt"
        )
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument('csv', nargs='?', default='owid-co2-data.csv',
                        help='path to owid-co2-data.csv (default: ./owid-co2-data.csv)')
    parser.add_argument('--year', type=int, default=None,
                        help='data year (default: the newest complete year in the file); '
                             'older values are used where this year is empty')
    parser.add_argument('--force', action='store_true',
                        help='write even an older year or far fewer countries than before')
    args = parser.parse_args()

    if not os.path.isfile(args.csv):
        log.error(f'Input file not found: {args.csv}')
        log.error(f'Download it from {SOURCE_URL}')
        sys.exit(1)

    if args.year is None:
        try:
            args.year = latest_complete_year(args.csv)
        except ValueError as err:
            log.error(str(err))
            sys.exit(1)
        log.info(f'Newest complete year in the file: {args.year}')

    # Look back up to two years for cells the data year does not have yet
    # (consumption-based data usually lags a year behind).
    years = [str(args.year - offset) for offset in range(3)]
    world_years = {str(y) for y in range(BUDGET_BASE_YEAR, args.year + 1)}
    rows, world = read_rows(args.csv, set(years), world_years)
    countries, unmatched = build_countries(rows, years)

    try:
        world_totals = build_world_totals(world, years[0])
    except ValueError as err:
        log.error(str(err))
        sys.exit(1)

    errors = validate(countries, world_totals)
    if errors:
        for err in errors:
            log.error(err)
        sys.exit(1)

    existing = read_existing(OUTPUT_PATH)
    if existing:
        old_meta, old_countries, old_world = existing
        if (old_meta.get('dataYear') == args.year and old_countries == countries
                and old_world == world_totals):
            log.info(f'No change: {OUTPUT_PATH} already has this data ({args.year})')
            return
        problems = []
        if old_meta.get('dataYear', 0) > args.year:
            problems.append(f"data year would go back from {old_meta['dataYear']} to {args.year}")
        if len(countries) < 0.95 * len(old_countries):
            problems.append(f'countries would drop from {len(old_countries)} to {len(countries)}')
        if problems and not args.force:
            for problem in problems:
                log.error(f'Refusing to write: {problem} (use --force to write anyway)')
            sys.exit(1)

    meta = {
        'dataYear': args.year,
        'generated': datetime.date.today().isoformat(),
        'sourceFile': os.path.basename(args.csv),
        'sourceSha256': sha256_of(args.csv),
    }
    with open(OUTPUT_PATH, 'w', encoding='utf-8', newline='\n') as f:
        f.write(render_js(countries, world_totals, meta))

    log.info(f'Matched {len(countries)} countries')
    if unmatched:
        log.warning(f'ISO codes without a map shape ({len(unmatched)}): {unmatched}')
    log.info(f'World totals: {world_totals}')
    for key, label in (('840', 'USA'), ('156', 'China'), ('356', 'India'), ('276', 'Germany')):
        c = countries.get(key)
        if c:
            log.info(f"  {label}: pop={c['pop']}M, co2={c['co2']}Mt, cons={c['cons']}Mt, hist={c['hist']}Gt")
    log.info(f'Wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()

/**
 * CO2 Budget Map — hand-maintained configuration
 *
 * Everything in this file is an editorial decision, not generated data:
 * which territories are counted under which country, and the assumptions
 * behind the Paris budgets. `generate_data.py` never touches this file.
 */

// ============================================================================
// Territories
// ============================================================================

// Territories whose emissions are counted under a parent country
const TERRITORY_PARENTS = {
  "732": "Morocco",           // Western Sahara
  "254": "France",            // French Guiana
  "312": "France",            // Guadeloupe
  "474": "France",            // Martinique
  "638": "France",            // Réunion
  "175": "France",            // Mayotte
  "652": "France",            // Saint Barthélemy
  "663": "France",            // Saint Martin
  "831": "United Kingdom",    // Guernsey
  "832": "United Kingdom",    // Jersey
  "833": "United Kingdom",    // Isle of Man
  "248": "Finland",           // Åland Islands
  "016": "United States",     // American Samoa
  "574": "Australia",         // Norfolk Island
  "162": "Australia",         // Christmas Island
  "010": null,                // Antarctica (no parent)
  "336": null,                // Vatican (negligible)
  "580": "United States",     // Northern Mariana Islands
  "850": "United States",     // U.S. Virgin Islands
  "316": "United States",     // Guam
  "630": "United States",     // Puerto Rico
  "239": "United Kingdom",    // South Georgia and the South Sandwich Islands
  "086": "United Kingdom",    // British Indian Ocean Territory
  "612": "United Kingdom",    // Pitcairn Islands
  "238": "United Kingdom",    // Falkland Islands
  "136": "United Kingdom",    // Cayman Islands
  "260": "France",            // French Southern and Antarctic Lands
  "334": "Australia",         // Heard Island and McDonald Islands
  "Somaliland": "Somalia",    // Somaliland
  "Kosovo": null,             // Kosovo (disputed)
  "N. Cyprus": "Cyprus",      // Northern Cyprus
  "Indian Ocean Ter.": "Australia", // Indian Ocean Territories
  "Siachen Glacier": null     // Siachen Glacier (disputed)
};

// Names for territories (not in CO2_DATA)
const TERRITORY_NAMES = {
  "732": "Western Sahara",
  "254": "French Guiana",
  "312": "Guadeloupe",
  "474": "Martinique",
  "638": "Réunion",
  "175": "Mayotte",
  "652": "Saint Barthélemy",
  "663": "Saint Martin",
  "831": "Guernsey",
  "832": "Jersey",
  "833": "Isle of Man",
  "248": "Åland Islands",
  "016": "American Samoa",
  "574": "Norfolk Island",
  "162": "Christmas Island",
  "010": "Antarctica",
  "336": "Vatican City",
  "580": "Northern Mariana Islands",
  "850": "U.S. Virgin Islands",
  "316": "Guam",
  "630": "Puerto Rico",
  "239": "South Georgia and the South Sandwich Islands",
  "086": "British Indian Ocean Territory",
  "612": "Pitcairn Islands",
  "238": "Falkland Islands",
  "136": "Cayman Islands",
  "260": "French Southern and Antarctic Lands",
  "334": "Heard Island and McDonald Islands",
  "Somaliland": "Somaliland",
  "Kosovo": "Kosovo",
  "N. Cyprus": "Northern Cyprus",
  "Indian Ocean Ter.": "Indian Ocean Territories",
  "Siachen Glacier": "Siachen Glacier"
};

// ============================================================================
// Paris Budgets
// ============================================================================
//
// Remaining carbon budgets from the start of 2020, IPCC AR6 WG1,
// Summary for Policymakers, Table SPM.2:
//   1.5 °C with 50 % likelihood:   500 Gt CO₂
//   2.0 °C with 67 % likelihood: 1,150 Gt CO₂
// (For comparison, 2.0 °C with 50 % would be 1,350 Gt.)
//
// From that we subtract what the world has emitted from 2020 up to the
// data year (it comes with the data: WORLD_TOTALS.emittedSince2020) and
// spread the rest evenly over the years after the data year up to 2050,
// and over everyone alive today. So the remaining budget moves on by
// itself when newer data arrives. The per-capita figures are derived in
// js/metrics.js, never typed in here.

const BUDGET_BASE_YEAR = 2020;       // the year the IPCC budgets count from
const BUDGET_TARGET_YEAR = 2050;     // net-zero year the budget is spread to

const PARIS_BUDGETS = {
  paris:  { warming: 1.5, likelihood: 50, from2020: 500 },
  paris2: { warming: 2.0, likelihood: 67, from2020: 1150 },
};

// A newer, stricter estimate, shown as a note in "How this is calculated"
// (the map itself keeps the IPCC figures above): remaining budget in Gt CO₂
// from the start of `fromYear`. Forster et al. (2026), Indicators of
// Global Climate Change, Earth System Science Data 18, 3889.
const NEWER_BUDGET_ESTIMATE = {
  warming: 1.5,
  likelihood: 50,
  fromYear: 2026,
  remaining: 130,
  url: 'https://doi.org/10.5194/essd-18-3889-2026',
};

// ============================================================================
// Country Codes
// ============================================================================
//
// ISO 3166 two-letter code -> the numeric id used in the data and the map
// shapes. Used to find the visitor's own country from what the browser
// knows (time zone, language region); see guessHomeCountry in js/app.js.

const REGION_IDS = {
  AD: '020', AE: '784', AF: '004', AG: '028', AI: '660', AL: '008', AM: '051', AO: '024',
  AR: '032', AT: '040', AU: '036', AW: '533', AZ: '031', BA: '070', BB: '052', BD: '050',
  BE: '056', BF: '854', BG: '100', BH: '048', BI: '108', BJ: '204', BM: '060', BN: '096',
  BO: '068', BQ: '535', BR: '076', BS: '044', BT: '064', BW: '072', BY: '112', BZ: '084',
  CA: '124', CD: '180', CF: '140', CG: '178', CH: '756', CI: '384', CK: '184', CL: '152',
  CM: '120', CN: '156', CO: '170', CR: '188', CU: '192', CV: '132', CW: '531', CY: '196',
  CZ: '203', DE: '276', DJ: '262', DK: '208', DM: '212', DO: '214', DZ: '012', EC: '218',
  EE: '233', EG: '818', ER: '232', ES: '724', ET: '231', FI: '246', FJ: '242', FM: '583',
  FO: '234', FR: '250', GA: '266', GB: '826', GD: '308', GE: '268', GH: '288', GL: '304',
  GM: '270', GN: '324', GQ: '226', GR: '300', GT: '320', GW: '624', GY: '328', HK: '344',
  HN: '340', HR: '191', HT: '332', HU: '348', ID: '360', IE: '372', IL: '376', IN: '356',
  IQ: '368', IR: '364', IS: '352', IT: '380', JM: '388', JO: '400', JP: '392', KE: '404',
  KG: '417', KH: '116', KI: '296', KM: '174', KN: '659', KP: '408', KR: '410', KW: '414',
  KZ: '398', LA: '418', LB: '422', LC: '662', LI: '438', LK: '144', LR: '430', LS: '426',
  LT: '440', LU: '442', LV: '428', LY: '434', MA: '504', MC: '492', MD: '498', ME: '499',
  MG: '450', MH: '584', MK: '807', ML: '466', MM: '104', MN: '496', MO: '446', MR: '478',
  MS: '500', MT: '470', MU: '480', MV: '462', MW: '454', MX: '484', MY: '458', MZ: '508',
  NA: '516', NC: '540', NE: '562', NG: '566', NI: '558', NL: '528', NO: '578', NP: '524',
  NR: '520', NU: '570', NZ: '554', OM: '512', PA: '591', PE: '604', PF: '258', PG: '598',
  PH: '608', PK: '586', PL: '616', PM: '666', PS: '275', PT: '620', PW: '585', PY: '600',
  QA: '634', RO: '642', RS: '688', RU: '643', RW: '646', SA: '682', SB: '090', SC: '690',
  SD: '729', SE: '752', SG: '702', SH: '654', SI: '705', SK: '703', SL: '694', SM: '674',
  SN: '686', SO: '706', SR: '740', SS: '728', ST: '678', SV: '222', SX: '534', SY: '760',
  SZ: '748', TC: '796', TD: '148', TG: '768', TH: '764', TJ: '762', TL: '626', TM: '795',
  TN: '788', TO: '776', TR: '792', TT: '780', TV: '798', TW: '158', TZ: '834', UA: '804',
  UG: '800', US: '840', UY: '858', UZ: '860', VC: '670', VE: '862', VG: '092', VN: '704',
  VU: '548', WF: '876', WS: '882', YE: '887', ZA: '710', ZM: '894', ZW: '716',
};

// Time zones that go by two names: browsers disagree on which one to report.
const TIME_ZONE_ALIASES = [
  ['Asia/Calcutta', 'Asia/Kolkata'],
  ['Europe/Kiev', 'Europe/Kyiv'],
  ['Asia/Saigon', 'Asia/Ho_Chi_Minh'],
  ['Asia/Katmandu', 'Asia/Kathmandu'],
  ['Asia/Rangoon', 'Asia/Yangon'],
  ['Asia/Dacca', 'Asia/Dhaka'],
  ['America/Buenos_Aires', 'America/Argentina/Buenos_Aires'],
  ['America/Godthab', 'America/Nuuk'],
  ['Atlantic/Faeroe', 'Atlantic/Faroe'],
];

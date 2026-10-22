// Main container gateways per country, with the share of the country's container trade assigned to each.
// Shares are rough splits by coast/gateway, not measured throughput. They let a US import from Asia land
// partly on the West Coast and partly via Panama to the East Coast, as real services do.
// Keyed by Comtrade M49 code. Coordinates come from data-raw/unlocode-ports.json (UN/LOCODE).
export const COUNTRY_PORTS = {
  842: { iso3: 'USA', name: 'United States', ports: { USLAX: 0.4, USNYC: 0.25, USSAV: 0.2, USHOU: 0.15 } },
  156: { iso3: 'CHN', name: 'China', ports: { CNSHA: 0.35, CNNGB: 0.25, CNYTN: 0.25, CNTAO: 0.15 } },
  276: { iso3: 'DEU', name: 'Germany', ports: { DEHAM: 0.6, DEBRV: 0.4 } },
  528: { iso3: 'NLD', name: 'Netherlands', ports: { NLRTM: 1 } },
  392: { iso3: 'JPN', name: 'Japan', ports: { JPTYO: 0.5, JPUKB: 0.5 } },
  826: { iso3: 'GBR', name: 'United Kingdom', ports: { GBFXT: 0.6, GBSOU: 0.4 } },
  251: { iso3: 'FRA', name: 'France', ports: { FRLEH: 0.7, FRMRS: 0.3 } },
  410: { iso3: 'KOR', name: 'South Korea', ports: { KRPUS: 1 } },
  344: { iso3: 'HKG', name: 'Hong Kong', ports: { HKHKG: 1 } },
  380: { iso3: 'ITA', name: 'Italy', ports: { ITGOA: 0.6, ITGIT: 0.4 } },
  699: { iso3: 'IND', name: 'India', ports: { INNSA: 0.5, INMUN: 0.3, INMAA: 0.2 } },
  484: { iso3: 'MEX', name: 'Mexico', ports: { MXZLO: 0.7, MXVER: 0.3 } },
  124: { iso3: 'CAN', name: 'Canada', ports: { CAVAN: 0.6, CAMTR: 0.4 } },
  56: { iso3: 'BEL', name: 'Belgium', ports: { BEANR: 1 } },
  724: { iso3: 'ESP', name: 'Spain', ports: { ESVLC: 0.6, ESALG: 0.4 } },
  702: { iso3: 'SGP', name: 'Singapore', ports: { SGSIN: 1 } },
  704: { iso3: 'VNM', name: 'Vietnam', ports: { VNSGN: 0.6, VNHPH: 0.4 } },
  784: { iso3: 'ARE', name: 'UAE', ports: { AEJEA: 1 } },
  490: { iso3: 'TWN', name: 'Taiwan', ports: { TWKHH: 1 } },
  616: { iso3: 'POL', name: 'Poland', ports: { PLGDN: 1 } },
  36: { iso3: 'AUS', name: 'Australia', ports: { AUMEL: 0.5, AUSYD: 0.5 } },
  764: { iso3: 'THA', name: 'Thailand', ports: { THLCH: 1 } },
  458: { iso3: 'MYS', name: 'Malaysia', ports: { MYPKG: 0.7, MYTPP: 0.3 } },
  76: { iso3: 'BRA', name: 'Brazil', ports: { BRSSZ: 1 } },
  792: { iso3: 'TUR', name: 'Türkiye', ports: { TRMER: 0.4, TRAMB: 0.6 } },
  360: { iso3: 'IDN', name: 'Indonesia', ports: { IDTPP: 0.7, IDSUB: 0.3 } },
  682: { iso3: 'SAU', name: 'Saudi Arabia', ports: { SAJED: 0.7, SADMM: 0.3 } },
  608: { iso3: 'PHL', name: 'Philippines', ports: { PHMNL: 1 } },
  710: { iso3: 'ZAF', name: 'South Africa', ports: { ZADUR: 1 } },
  152: { iso3: 'CHL', name: 'Chile', ports: { CLSAI: 1 } },
  376: { iso3: 'ISR', name: 'Israel', ports: { ILHFA: 1 } },
  818: { iso3: 'EGY', name: 'Egypt', ports: { EGPSD: 1 } },
  752: { iso3: 'SWE', name: 'Sweden', ports: { SEGOT: 1 } },
  566: { iso3: 'NGA', name: 'Nigeria', ports: { NGAPP: 1 } },
  50: { iso3: 'BGD', name: 'Bangladesh', ports: { BDCGP: 1 } },
  586: { iso3: 'PAK', name: 'Pakistan', ports: { PKKHI: 1 } },
  604: { iso3: 'PER', name: 'Peru', ports: { PECLL: 1 } },
  170: { iso3: 'COL', name: 'Colombia', ports: { COCTG: 1 } },
  32: { iso3: 'ARG', name: 'Argentina', ports: { ARBUE: 1 } },
  554: { iso3: 'NZL', name: 'New Zealand', ports: { NZAKL: 1 } },
  300: { iso3: 'GRC', name: 'Greece', ports: { GRPIR: 1 } },
  620: { iso3: 'PRT', name: 'Portugal', ports: { PTSIE: 1 } },
  208: { iso3: 'DNK', name: 'Denmark', ports: { DKAAR: 1 } },
  579: { iso3: 'NOR', name: 'Norway', ports: { NOOSL: 1 } },
  372: { iso3: 'IRL', name: 'Ireland', ports: { IEDUB: 1 } },
  246: { iso3: 'FIN', name: 'Finland', ports: { FIHEL: 1 } },
  504: { iso3: 'MAR', name: 'Morocco', ports: { MAPTM: 1 } },
  404: { iso3: 'KEN', name: 'Kenya', ports: { KEMBA: 1 } },
  144: { iso3: 'LKA', name: 'Sri Lanka', ports: { LKCMB: 1 } },
  634: { iso3: 'QAT', name: 'Qatar', ports: { QADOH: 1 } },
  414: { iso3: 'KWT', name: 'Kuwait', ports: { KWSWK: 1 } },
  512: { iso3: 'OMN', name: 'Oman', ports: { OMSLL: 1 } },
  // Exporters that aren't in the reporter list but ship a lot of containers
  116: { iso3: 'KHM', name: 'Cambodia', ports: { KHKOS: 1 } },
  643: { iso3: 'RUS', name: 'Russia', ports: { RULED: 0.5, RUVVO: 0.5 } },
  364: { iso3: 'IRN', name: 'Iran', ports: { IRBND: 1 } },
  218: { iso3: 'ECU', name: 'Ecuador', ports: { ECGYE: 1 } },
  858: { iso3: 'URY', name: 'Uruguay', ports: { UYMVD: 1 } },
  288: { iso3: 'GHA', name: 'Ghana', ports: { GHTEM: 1 } },
  384: { iso3: 'CIV', name: "Côte d'Ivoire", ports: { CIABJ: 1 } },
  788: { iso3: 'TUN', name: 'Tunisia', ports: { TNRDS: 1 } },
  400: { iso3: 'JOR', name: 'Jordan', ports: { JOAQJ: 1 } },
  104: { iso3: 'MMR', name: 'Myanmar', ports: { MMRGN: 1 } },
};

// Trade inside these blocs moves mostly by road, rail or short-sea ferry, so it is left out of the
// deep-sea container picture.
export const LAND_BLOCS = [
  ['DEU', 'NLD', 'GBR', 'FRA', 'ITA', 'BEL', 'ESP', 'POL', 'SWE', 'GRC', 'PRT', 'DNK', 'NOR', 'IRL', 'FIN'],
  ['USA', 'CAN', 'MEX'],
  ['ARE', 'SAU', 'QAT', 'KWT', 'OMN', 'JOR'],
  ['CHN', 'HKG'],
  ['SGP', 'MYS', 'THA'],
  ['ARG', 'BRA', 'URY', 'CHL'],
];

// Corrections where the bundled UN/LOCODE coordinates are wrong ([lng, lat]).
export const PORT_COORD_OVERRIDES = {
  CNYTN: [114.27, 22.57], // Yantian, Shenzhen (table had a Fujian location)
  TRAMB: [28.68, 40.97], // Ambarli, Istanbul (table had a Black Sea coast location)
};

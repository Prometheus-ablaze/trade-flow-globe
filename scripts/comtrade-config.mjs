// HS-2 chapters used as a proxy for containerized trade (manufactured goods; bulk and energy excluded).
// 87 (vehicles) is mixed: finished cars ride RoRo carriers, parts ride containers. Kept, but flagged in the UI notes.
export const CONTAINER_CHAPTERS = ['39', '40', '61', '62', '64', '73', '84', '85', '87', '90', '94', '95'];

// Major importers queried as reporters. Comtrade uses M49 codes; Taiwan reports as 490 ("Other Asia, nes").
export const REPORTERS = [
  ['USA', 842], ['CHN', 156], ['DEU', 276], ['NLD', 528], ['JPN', 392], ['GBR', 826], ['FRA', 251],
  ['KOR', 410], ['HKG', 344], ['ITA', 380], ['IND', 699], ['MEX', 484], ['CAN', 124], ['BEL', 56],
  ['ESP', 724], ['SGP', 702], ['VNM', 704], ['ARE', 784], ['TWN', 490], ['POL', 616], ['AUS', 36],
  ['THA', 764], ['MYS', 458], ['BRA', 76], ['TUR', 792], ['IDN', 360], ['SAU', 682], ['PHL', 608],
  ['ZAF', 710], ['CHL', 152], ['ISR', 376], ['EGY', 818], ['SWE', 752], ['NGA', 566], ['BGD', 50],
  ['PAK', 586], ['PER', 604], ['COL', 170], ['ARG', 32], ['NZL', 554], ['GRC', 300], ['PRT', 620],
  ['DNK', 208], ['NOR', 579], ['IRL', 372], ['FIN', 246], ['MAR', 504], ['KEN', 404], ['LKA', 144],
  ['QAT', 634], ['KWT', 414], ['OMN', 512],
].map(([iso3, m49]) => ({ iso3, m49 }));

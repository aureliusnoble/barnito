import type { EPlayer } from "../types";

// 5 forwards/wingers per team (120 total), plausible squads for June 2028.
// rating 62–98 drives anytime-scorer odds; only six sit above 90.
export const FORWARDS: EPlayer[] = [
  // England
  { id: "england-harry-kane", name: "Harry Kane", teamId: "england", rating: 93 },
  { id: "england-bukayo-saka", name: "Bukayo Saka", teamId: "england", rating: 91 },
  { id: "england-cole-palmer", name: "Cole Palmer", teamId: "england", rating: 88 },
  { id: "england-phil-foden", name: "Phil Foden", teamId: "england", rating: 86 },
  { id: "england-anthony-gordon", name: "Anthony Gordon", teamId: "england", rating: 83 },
  // Croatia
  { id: "croatia-franjo-ivanovic", name: "Franjo Ivanović", teamId: "croatia", rating: 77 },
  { id: "croatia-andrej-kramaric", name: "Andrej Kramarić", teamId: "croatia", rating: 75 },
  { id: "croatia-marco-pasalic", name: "Marco Pašalić", teamId: "croatia", rating: 73 },
  { id: "croatia-igor-matanovic", name: "Igor Matanović", teamId: "croatia", rating: 71 },
  { id: "croatia-dion-drena-beljo", name: "Dion Drena Beljo", teamId: "croatia", rating: 68 },
  // Czechia
  { id: "czechia-patrik-schick", name: "Patrik Schick", teamId: "czechia", rating: 81 },
  { id: "czechia-adam-hlozek", name: "Adam Hložek", teamId: "czechia", rating: 75 },
  { id: "czechia-vaclav-cerny", name: "Václav Černý", teamId: "czechia", rating: 72 },
  { id: "czechia-jan-kuchta", name: "Jan Kuchta", teamId: "czechia", rating: 69 },
  { id: "czechia-ondrej-lingr", name: "Ondřej Lingr", teamId: "czechia", rating: 66 },
  // Greece
  { id: "greece-vangelis-pavlidis", name: "Vangelis Pavlidis", teamId: "greece", rating: 76 },
  { id: "greece-christos-tzolis", name: "Christos Tzolis", teamId: "greece", rating: 74 },
  { id: "greece-fotis-ioannidis", name: "Fotis Ioannidis", teamId: "greece", rating: 73 },
  { id: "greece-konstantinos-karetsas", name: "Konstantinos Karetsas", teamId: "greece", rating: 71 },
  { id: "greece-stefanos-tzimas", name: "Stefanos Tzimas", teamId: "greece", rating: 68 },
  // Spain
  { id: "spain-lamine-yamal", name: "Lamine Yamal", teamId: "spain", rating: 97 },
  { id: "spain-nico-williams", name: "Nico Williams", teamId: "spain", rating: 88 },
  { id: "spain-dani-olmo", name: "Dani Olmo", teamId: "spain", rating: 85 },
  { id: "spain-mikel-oyarzabal", name: "Mikel Oyarzabal", teamId: "spain", rating: 83 },
  { id: "spain-samu-aghehowa", name: "Samu Aghehowa", teamId: "spain", rating: 79 },
  // Italy
  { id: "italy-mateo-retegui", name: "Mateo Retegui", teamId: "italy", rating: 84 },
  { id: "italy-moise-kean", name: "Moise Kean", teamId: "italy", rating: 82 },
  { id: "italy-francesco-pio-esposito", name: "Francesco Pio Esposito", teamId: "italy", rating: 80 },
  { id: "italy-federico-chiesa", name: "Federico Chiesa", teamId: "italy", rating: 78 },
  { id: "italy-giacomo-raspadori", name: "Giacomo Raspadori", teamId: "italy", rating: 76 },
  // Türkiye
  { id: "turkiye-kenan-yildiz", name: "Kenan Yıldız", teamId: "turkiye", rating: 88 },
  { id: "turkiye-arda-guler", name: "Arda Güler", teamId: "turkiye", rating: 87 },
  { id: "turkiye-kerem-akturkoglu", name: "Kerem Aktürkoğlu", teamId: "turkiye", rating: 76 },
  { id: "turkiye-baris-alper-yilmaz", name: "Barış Alper Yılmaz", teamId: "turkiye", rating: 75 },
  { id: "turkiye-semih-kilicsoy", name: "Semih Kılıçsoy", teamId: "turkiye", rating: 73 },
  // Scotland
  { id: "scotland-che-adams", name: "Ché Adams", teamId: "scotland", rating: 74 },
  { id: "scotland-ben-doak", name: "Ben Doak", teamId: "scotland", rating: 72 },
  { id: "scotland-lyndon-dykes", name: "Lyndon Dykes", teamId: "scotland", rating: 69 },
  { id: "scotland-tommy-conway", name: "Tommy Conway", teamId: "scotland", rating: 67 },
  { id: "scotland-lawrence-shankland", name: "Lawrence Shankland", teamId: "scotland", rating: 65 },
  // France
  { id: "france-kylian-mbappe", name: "Kylian Mbappé", teamId: "france", rating: 98 },
  { id: "france-ousmane-dembele", name: "Ousmane Dembélé", teamId: "france", rating: 89 },
  { id: "france-michael-olise", name: "Michael Olise", teamId: "france", rating: 87 },
  { id: "france-desire-doue", name: "Désiré Doué", teamId: "france", rating: 86 },
  { id: "france-bradley-barcola", name: "Bradley Barcola", teamId: "france", rating: 84 },
  // Austria
  { id: "austria-christoph-baumgartner", name: "Christoph Baumgartner", teamId: "austria", rating: 78 },
  { id: "austria-patrick-wimmer", name: "Patrick Wimmer", teamId: "austria", rating: 73 },
  { id: "austria-sasa-kalajdzic", name: "Saša Kalajdžić", teamId: "austria", rating: 70 },
  { id: "austria-junior-adamu", name: "Junior Adamu", teamId: "austria", rating: 68 },
  { id: "austria-michael-gregoritsch", name: "Michael Gregoritsch", teamId: "austria", rating: 65 },
  // Ukraine
  { id: "ukraine-artem-dovbyk", name: "Artem Dovbyk", teamId: "ukraine", rating: 80 },
  { id: "ukraine-georgiy-sudakov", name: "Georgiy Sudakov", teamId: "ukraine", rating: 77 },
  { id: "ukraine-viktor-tsygankov", name: "Viktor Tsygankov", teamId: "ukraine", rating: 75 },
  { id: "ukraine-vladyslav-vanat", name: "Vladyslav Vanat", teamId: "ukraine", rating: 73 },
  { id: "ukraine-oleksandr-zubkov", name: "Oleksandr Zubkov", teamId: "ukraine", rating: 68 },
  // Wales
  { id: "wales-brennan-johnson", name: "Brennan Johnson", teamId: "wales", rating: 79 },
  { id: "wales-daniel-james", name: "Daniel James", teamId: "wales", rating: 72 },
  { id: "wales-harry-wilson", name: "Harry Wilson", teamId: "wales", rating: 70 },
  { id: "wales-kieffer-moore", name: "Kieffer Moore", teamId: "wales", rating: 65 },
  { id: "wales-rabbi-matondo", name: "Rabbi Matondo", teamId: "wales", rating: 62 },
  // Portugal
  { id: "portugal-rafael-leao", name: "Rafael Leão", teamId: "portugal", rating: 89 },
  { id: "portugal-goncalo-ramos", name: "Gonçalo Ramos", teamId: "portugal", rating: 83 },
  { id: "portugal-francisco-conceicao", name: "Francisco Conceição", teamId: "portugal", rating: 82 },
  { id: "portugal-pedro-neto", name: "Pedro Neto", teamId: "portugal", rating: 81 },
  { id: "portugal-geovany-quenda", name: "Geovany Quenda", teamId: "portugal", rating: 78 },
  // Belgium
  { id: "belgium-jeremy-doku", name: "Jérémy Doku", teamId: "belgium", rating: 86 },
  { id: "belgium-lois-openda", name: "Loïs Openda", teamId: "belgium", rating: 82 },
  { id: "belgium-charles-de-ketelaere", name: "Charles De Ketelaere", teamId: "belgium", rating: 80 },
  { id: "belgium-romelu-lukaku", name: "Romelu Lukaku", teamId: "belgium", rating: 79 },
  { id: "belgium-johan-bakayoko", name: "Johan Bakayoko", teamId: "belgium", rating: 74 },
  // Norway
  { id: "norway-erling-haaland", name: "Erling Haaland", teamId: "norway", rating: 97 },
  { id: "norway-alexander-sorloth", name: "Alexander Sørloth", teamId: "norway", rating: 80 },
  { id: "norway-antonio-nusa", name: "Antonio Nusa", teamId: "norway", rating: 79 },
  { id: "norway-jorgen-strand-larsen", name: "Jørgen Strand Larsen", teamId: "norway", rating: 77 },
  { id: "norway-oscar-bobb", name: "Oscar Bobb", teamId: "norway", rating: 75 },
  // Republic of Ireland
  { id: "republic-of-ireland-evan-ferguson", name: "Evan Ferguson", teamId: "republic-of-ireland", rating: 79 },
  { id: "republic-of-ireland-troy-parrott", name: "Troy Parrott", teamId: "republic-of-ireland", rating: 73 },
  { id: "republic-of-ireland-adam-idah", name: "Adam Idah", teamId: "republic-of-ireland", rating: 70 },
  { id: "republic-of-ireland-chiedozie-ogbene", name: "Chiedozie Ogbene", teamId: "republic-of-ireland", rating: 68 },
  { id: "republic-of-ireland-sammie-szmodics", name: "Sammie Szmodics", teamId: "republic-of-ireland", rating: 66 },
  // Germany
  { id: "germany-jamal-musiala", name: "Jamal Musiala", teamId: "germany", rating: 92 },
  { id: "germany-florian-wirtz", name: "Florian Wirtz", teamId: "germany", rating: 90 },
  { id: "germany-kai-havertz", name: "Kai Havertz", teamId: "germany", rating: 85 },
  { id: "germany-nick-woltemade", name: "Nick Woltemade", teamId: "germany", rating: 83 },
  { id: "germany-leroy-sane", name: "Leroy Sané", teamId: "germany", rating: 81 },
  // Switzerland
  { id: "switzerland-dan-ndoye", name: "Dan Ndoye", teamId: "switzerland", rating: 78 },
  { id: "switzerland-breel-embolo", name: "Breel Embolo", teamId: "switzerland", rating: 76 },
  { id: "switzerland-noah-okafor", name: "Noah Okafor", teamId: "switzerland", rating: 74 },
  { id: "switzerland-ruben-vargas", name: "Ruben Vargas", teamId: "switzerland", rating: 73 },
  { id: "switzerland-zeki-amdouni", name: "Zeki Amdouni", teamId: "switzerland", rating: 71 },
  // Poland
  { id: "poland-krzysztof-piatek", name: "Krzysztof Piątek", teamId: "poland", rating: 76 },
  { id: "poland-nicola-zalewski", name: "Nicola Zalewski", teamId: "poland", rating: 74 },
  { id: "poland-karol-swiderski", name: "Karol Świderski", teamId: "poland", rating: 72 },
  { id: "poland-jakub-kaminski", name: "Jakub Kamiński", teamId: "poland", rating: 71 },
  { id: "poland-adam-buksa", name: "Adam Buksa", teamId: "poland", rating: 69 },
  // Hungary
  { id: "hungary-dominik-szoboszlai", name: "Dominik Szoboszlai", teamId: "hungary", rating: 84 },
  { id: "hungary-roland-sallai", name: "Roland Sallai", teamId: "hungary", rating: 75 },
  { id: "hungary-barnabas-varga", name: "Barnabás Varga", teamId: "hungary", rating: 71 },
  { id: "hungary-kevin-csoboth", name: "Kevin Csoboth", teamId: "hungary", rating: 67 },
  { id: "hungary-krisztofer-horvath", name: "Krisztofer Horváth", teamId: "hungary", rating: 63 },
  // Netherlands
  { id: "netherlands-cody-gakpo", name: "Cody Gakpo", teamId: "netherlands", rating: 87 },
  { id: "netherlands-xavi-simons", name: "Xavi Simons", teamId: "netherlands", rating: 84 },
  { id: "netherlands-donyell-malen", name: "Donyell Malen", teamId: "netherlands", rating: 80 },
  { id: "netherlands-noa-lang", name: "Noa Lang", teamId: "netherlands", rating: 78 },
  { id: "netherlands-brian-brobbey", name: "Brian Brobbey", teamId: "netherlands", rating: 76 },
  // Denmark
  { id: "denmark-rasmus-hojlund", name: "Rasmus Højlund", teamId: "denmark", rating: 84 },
  { id: "denmark-conrad-harder", name: "Conrad Harder", teamId: "denmark", rating: 76 },
  { id: "denmark-andreas-skov-olsen", name: "Andreas Skov Olsen", teamId: "denmark", rating: 75 },
  { id: "denmark-jonas-wind", name: "Jonas Wind", teamId: "denmark", rating: 74 },
  { id: "denmark-gustav-isaksen", name: "Gustav Isaksen", teamId: "denmark", rating: 72 },
  // Serbia
  { id: "serbia-dusan-vlahovic", name: "Dušan Vlahović", teamId: "serbia", rating: 84 },
  { id: "serbia-aleksandar-mitrovic", name: "Aleksandar Mitrović", teamId: "serbia", rating: 79 },
  { id: "serbia-lazar-samardzic", name: "Lazar Samardžić", teamId: "serbia", rating: 76 },
  { id: "serbia-luka-jovic", name: "Luka Jović", teamId: "serbia", rating: 71 },
  { id: "serbia-andrija-zivkovic", name: "Andrija Živković", teamId: "serbia", rating: 68 },
  // Sweden
  { id: "sweden-alexander-isak", name: "Alexander Isak", teamId: "sweden", rating: 89 },
  { id: "sweden-viktor-gyokeres", name: "Viktor Gyökeres", teamId: "sweden", rating: 88 },
  { id: "sweden-dejan-kulusevski", name: "Dejan Kulusevski", teamId: "sweden", rating: 80 },
  { id: "sweden-anthony-elanga", name: "Anthony Elanga", teamId: "sweden", rating: 77 },
  { id: "sweden-roony-bardghji", name: "Roony Bardghji", teamId: "sweden", rating: 73 },
];

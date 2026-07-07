// 1000 tierlists pré-générées (100 thèmes × 10 éditions)
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = Math.abs(seed % 2147483647) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const EDITIONS = [
  'Classement Officiel', 'Édition Expert', 'Classement du Fan',
  'Édition Nostalgie', 'Classement Communautaire', 'Édition Controversée',
  'Classement Popularité', 'Édition Hardcore', 'Édition Ultime', 'Classement Débutant',
];

const THEMES = [
  // ── ANIME ───────────────────────────────────────────────────────
  ['Personnages de Naruto', ['Naruto','Sasuke','Kakashi','Itachi','Minato','Jiraiya','Madara','Obito','Pain','Gaara','Rock Lee','Neji','Hinata','Sakura','Shikamaru','Tsunade','Orochimaru','Kabuto']],
  ['Personnages de One Piece', ['Luffy','Zoro','Nami','Usopp','Sanji','Chopper','Robin','Franky','Brook','Shanks','Whitebeard','Ace','Garp','Kaido','Big Mom','Law','Crocodile','Doflamingo']],
  ['Personnages de Dragon Ball Z', ['Goku','Vegeta','Gohan','Piccolo','Frieza','Cell','Majin Buu','Trunks','Android 17','Android 18','Krillin','Tien','Broly','Cooler','Bardock','Vegeto','Gogeta','Hercule']],
  ['Personnages de Bleach', ['Ichigo','Rukia','Renji','Byakuya','Kenpachi','Toshiro','Orihime','Uryu','Chad','Yoruichi','Aizen','Gin','Ulquiorra','Grimmjow','Urahara','Isshin','Mayuri','Nel']],
  ['Personnages d\'Attack on Titan', ['Eren','Mikasa','Armin','Levi','Hange','Erwin','Reiner','Bertholdt','Annie','Historia','Ymir','Jean','Connie','Sasha','Zeke','Porco','Pieck','Gabi']],
  ['Personnages de My Hero Academia', ['Deku','Bakugo','Todoroki','Uraraka','All Might','Endeavor','Hawks','Dabi','Shigaraki','All For One','Aizawa','Tokoyami','Kirishima','Denki','Mina','Momo','Iida','Tsuyu']],
  ['Personnages de Death Note', ['Light Yagami','L Lawliet','Misa Amane','Near','Mello','Ryuk','Rem','Matsuda','Soichiro','Mikami','Kiyomi Takada','Watari','Wedy','Halle','Gevanni','Mogi','Aizawa','Ide']],
  ['Personnages de Demon Slayer', ['Tanjiro','Nezuko','Zenitsu','Inosuke','Giyu','Shinobu','Rengoku','Tengen','Muzan','Akaza','Doma','Kokushibo','Kanao','Gyomei','Obanai','Mitsuri','Sanemi','Genya']],
  ['Personnages de Hunter x Hunter', ['Gon','Killua','Kurapika','Leorio','Hisoka','Chrollo','Illumi','Meruem','Neferpitou','Kite','Ging','Netero','Alluka','Feitan','Knuckle','Shoot','Morel','Phinks']],
  ['Personnages de Fullmetal Alchemist', ['Edward','Alphonse','Roy','Riza','Scar','Envy','Greed','Lust','Gluttony','Pride','Wrath','Sloth','Father','Izumi','Hughes','Winry','Kimblee','Lan Fan']],
  ['Personnages de Fairy Tail', ['Natsu','Lucy','Erza','Gray','Gajeel','Juvia','Wendy','Levi','Mirajane','Jellal','Zeref','Acnologia','Mavis','Laxus','Cana','Happy','Makarov','Mystogan']],
  ['Personnages de One Punch Man', ['Saitama','Genos','Bang','Tatsumaki','Fubuki','Garou','King','Metal Bat','Zombieman','Atomic Samurai','Child Emperor','Drive Knight','Flash','Pig God','Darkshine','Tank-Top Master','Sweet Mask','Watchdog Man']],
  ['Personnages de Tokyo Ghoul', ['Kaneki','Touka','Rize','Uta','Juzo','Arima','Eto','Hinami','Nishiki','Yamori','Hide','Tsukiyama','Tatara','Ayato','Akira','Shirazu','Mutsuki','Saiko']],
  ['Personnages de Re:Zero', ['Subaru','Emilia','Rem','Ram','Beatrice','Roswaal','Echidna','Satella','Elsa','Otto','Garfiel','Wilhelm','Crusch','Felt','Reinhard','Petelgeuse','Julius','Priscilla']],
  ['Personnages de JoJo\'s Bizarre Adventure', ['Dio','Giorno','Jotaro','Joseph','Jonathan','Jolyne','Josuke','Johnny','Gyro','Yoshikage Kira','Diavolo','Enrico Pucci','Wamuu','Esidisi','Kars','Caesar','Lisa Lisa','Narancia']],
  ['Personnages d\'Overlord', ['Ainz','Albedo','Shalltear','Cocytus','Demiurge','Sebas','Aura','Mare','Narberal','Lupusregina','CZ2128','Solution','Entoma','Yuri','Pandora','Evileye','Gazef','Climb']],
  ['Personnages de Konosuba', ['Kazuma','Aqua','Megumin','Darkness','Wiz','Yunyun','Chris','Vanir','Eris','Iris','Lalatina','Cecily','Hans','Beldia','Hyoizabofu','Dustiness','Chomusuke','Wolbach']],
  ['Personnages de Black Clover', ['Asta','Yuno','Noelle','Magna','Luck','Charmy','Gauche','Vanessa','Finral','Gordon','Grey','Henry','Yami','Julius','Fuegoleon','Mereoleona','Licht','Patry']],
  ['Personnages de Boruto', ['Boruto','Sarada','Mitsuki','Kawaki','Code','Daemon','Eida','Amado','Delta','Jigen','Koji','Victor','Ao','Deepa','Boro','Isshiki','Momoshiki','Shikadai']],
  ['Personnages de Sword Art Online', ['Kirito','Asuna','Sinon','Leafa','Yui','Klein','Agil','Eugeo','Alice','Heathcliff','Liz','Silica','Yuuki','Administrator','Sortiliena','Tiese','Ronie','Iskahn']],

  // ── GAMING ──────────────────────────────────────────────────────
  ['Pokémon de Kanto', ['Mewtwo','Gengar','Dragonite','Alakazam','Machamp','Lapras','Charizard','Blastoise','Venusaur','Pikachu','Snorlax','Gyarados','Mew','Eevee','Arcanine','Vaporeon','Jolteon','Flareon']],
  ['Pokémon de Johto', ['Lugia','Ho-Oh','Typhlosion','Feraligatr','Meganium','Espeon','Umbreon','Tyranitar','Scizor','Steelix','Ampharos','Heracross','Skarmory','Crobat','Blissey','Suicune','Entei','Raikou']],
  ['Pokémon de Hoenn', ['Rayquaza','Kyogre','Groudon','Salamence','Metagross','Milotic','Flygon','Aggron','Gardevoir','Blaziken','Swampert','Sceptile','Latias','Latios','Jirachi','Deoxys','Absol','Bagon']],
  ['Champions de League of Legends', ['Jinx','Lux','Zed','Yasuo','Akali','Thresh','Lee Sin','Ahri','Ezreal','Ashe','Vayne','Katarina','LeBlanc','Garen','Darius','Yone','Kai\'Sa','Ekko','Sylas','Teemo']],
  ['Agents de Valorant', ['Jett','Sage','Reyna','Phoenix','Brimstone','Omen','Viper','Sova','Killjoy','Raze','Breach','Skye','Yoru','Astra','Chamber','Neon','Fade','Harbor','Gekko','Deadlock']],
  ['Légendes d\'Apex Legends', ['Wraith','Octane','Pathfinder','Lifeline','Bloodhound','Gibraltar','Caustic','Mirage','Loba','Horizon','Fuse','Valkyrie','Seer','Ash','Mad Maggie','Newcastle','Vantage','Catalyst']],
  ['Personnages de Fortnite', ['Jonesy','Midas','Peely','Meowscles','Brutus','Deadpool','Cube Queen','The Foundation','Drift','Brite Bomber','Raven','The Mandalorian','Spider-Man','Paradigm','Slone','Doggo','Agent Jones','Bushranger']],
  ['Personnages d\'Overwatch 2', ['Genji','Tracer','Cassidy','Hanzo','Widowmaker','Pharah','Reaper','Soldier:76','Ana','Mercy','Lúcio','Reinhardt','Winston','D.Va','Zarya','Symmetra','Moira','Baptiste']],
  ['Personnages de Street Fighter', ['Ryu','Ken','Chun-Li','Guile','Zangief','Dhalsim','Blanka','Balrog','Vega','Sagat','M. Bison','Akuma','Cammy','Fei Long','Honda','Dee Jay','T-Hawk','Juni']],
  ['Personnages de Mortal Kombat', ['Scorpion','Sub-Zero','Liu Kang','Kung Lao','Johnny Cage','Sonya','Kitana','Mileena','Shang Tsung','Shao Kahn','Goro','Raiden','Jax','Kano','Smoke','Reptile','Jade','Ermac']],
  ['Personnages de Super Smash Bros', ['Mario','Pikachu','Link','Kirby','Donkey Kong','Fox','Ness','Marth','Mewtwo','Captain Falcon','Falco','Sheik','Zelda','Ganondorf','Young Link','Ice Climbers','Roy','Jigglypuff']],
  ['Maps de CS2 / CS:GO', ['Dust 2','Mirage','Inferno','Nuke','Vertigo','Overpass','Ancient','Anubis','Cache','Train','Cobblestone','Office','Assault','Agency','Italy','Aztec','Tuscan','Season']],
  ['Jeux Nintendo Switch', ['Zelda BOTW','Mario Odyssey','Smash Bros Ultimate','Animal Crossing','Mario Kart 8','Metroid Dread','Fire Emblem','Xenoblade Chronicles','Splatoon 3','Pokémon Violet','Bayonetta 3','Kirby Forgotten Land','Ring Fit Adventure','Luigi\'s Mansion 3','Astral Chain']],
  ['Jeux FromSoftware', ['Dark Souls','Dark Souls II','Dark Souls III','Bloodborne','Sekiro','Elden Ring','Demon\'s Souls','Armored Core VI','Shadow of the Erdtree','King\'s Field','Chromehounds','Otogi','Ninja Blade','The Adventures of Cookie','Steel Battalion']],
  ['Personnages de Genshin Impact', ['Hu Tao','Raiden Shogun','Venti','Zhongli','Kazuha','Bennett','Ganyu','Ayaka','Xiao','Nahida','Itto','Yelan','Kokomi','Cyno','Wanderer','Nilou','Fischl','Keqing']],

  // ── MUSIQUE ──────────────────────────────────────────────────────
  ['Rappeurs français', ['SCH','Nekfeu','Orelsan','PNL','Ninho','Booba','Rohff','Youssoupha','Lomepal','Lacrim','PLK','Freeze Corleone','Hamza','Jul','Rim\'K','Oxmo Puccino','Vald','Gaël Faye']],
  ['Albums de Kanye West', ['The College Dropout','Late Registration','Graduation','808s & Heartbreak','My Beautiful Dark Twisted Fantasy','Yeezus','The Life of Pablo','ye','Jesus Is King','Donda','Watch The Throne','Cruel Summer','Kids See Ghosts','Donda 2','Vultures 1']],
  ['Albums de Drake', ['Thank Me Later','Take Care','Nothing Was The Same','If You\'re Reading This','Views','More Life','Scorpion','Certified Lover Boy','Honestly Nevermind','For All The Dogs','Her Loss','So Far Gone','Dark Lane Demo Tapes','Care Package','Mixtape']],
  ['Albums d\'Eminem', ['Slim Shady LP','The Marshall Mathers LP','The Eminem Show','Encore','Relapse','Recovery','MMLP2','Revival','Kamikaze','Music to Be Murdered By','The Death of Slim Shady','Curtain Call','Infinite','Shady XV','Straight From The Lab']],
  ['Albums de Beyoncé', ['Dangerously in Love','B\'Day','I Am Sasha Fierce','4','Lemonade','Renaissance','Cowboy Carter','Destiny Fulfilled','Survivor','The Writing\'s on the Wall','Homecoming','Black Is King','8 Days of Christmas','#1s','In the Mix']],
  ['Albums de Taylor Swift', ['Taylor Swift','Fearless','Speak Now','Red','1989','Reputation','Lover','Folklore','Evermore','Midnights','The Tortured Poets Department','Fearless TV','Red TV','1989 TV','Speak Now TV']],
  ['Groupes de rock légendaires', ['Led Zeppelin','Pink Floyd','The Beatles','Rolling Stones','Queen','AC/DC','Nirvana','Metallica','Guns N\' Roses','Red Hot Chili Peppers','Radiohead','The Who','Aerosmith','Black Sabbath','Pearl Jam','Deep Purple','Foo Fighters','U2']],
  ['Rappeurs américains', ['Jay-Z','Kendrick Lamar','Eminem','Nas','Drake','Lil Wayne','J. Cole','2Pac','Biggie Smalls','Andre 3000','Rakim','Ice Cube','Snoop Dogg','DMX','Ludacris','Tyler the Creator','A$AP Rocky','Schoolboy Q']],
  ['Albums de Kendrick Lamar', ['Section.80','good kid m.A.A.d city','To Pimp a Butterfly','Untitled Unmastered','DAMN.','Mr. Morale & The Big Steppers','Black Panther OST','Overly Dedicated','Kendrick Lamar EP','Humble EP','Heart Pt. 1','Heart Pt. 2','Heart Pt. 3','Heart Pt. 4','Heart Pt. 5']],
  ['Artistes K-Pop', ['BTS','Blackpink','EXO','Twice','Red Velvet','NCT 127','Stray Kids','ITZY','aespa','Seventeen','TXT','IVE','NewJeans','LE SSERAFIM','Monsta X','GOT7','ATEEZ','Enhypen']],
  ['Festivals de musique', ['Coachella','Glastonbury','Tomorrowland','Ultra Music Festival','Rock en Seine','Les Vieilles Charrues','Hellfest','Sziget','Lollapalooza','Electric Daisy Carnival','Burning Man','Primavera Sound','Reading Festival','Download Festival','Bonnaroo','SXSW','Pitchfork Music Fest','Benicàssim']],
  ['Artistes électroniques', ['Daft Punk','Aphex Twin','Chemical Brothers','Deadmau5','Avicii','David Guetta','Martin Garrix','Skrillex','Calvin Harris','Diplo','DJ Snake','Madeon','Gesaffelstein','Justice','Kavinsky','Alan Walker','Marshmello','Kygo']],
  ['Chanteuses françaises', ['Édith Piaf','Françoise Hardy','France Gall','Barbara','Mylène Farmer','Céline Dion','Alizée','Zaz','Clara Luciani','Angèle','Pomme','Hoshi','Camélia Jordana','Camille','Indila','Yseult','Jain','Yelle']],
  ['Albums de Jay-Z', ['Reasonable Doubt','In My Lifetime Vol.1','Vol.2 Hard Knock Life','Vol.3 Life and Times','Dynasty','The Blueprint','Blueprint 2','The Black Album','Kingdom Come','American Gangster','Blueprint 3','Magna Carta Holy Grail','4:44','Everything Is Love','Unfinished Business']],
  ['Artistes R&B', ['Frank Ocean','The Weeknd','Usher','Alicia Keys','Beyoncé','Miguel','H.E.R.','SZA','Jhené Aiko','Bryson Tiller','Daniel Caesar','Giveon','Summer Walker','Kehlani','Brent Faiyaz','Lucky Daye','PJ Morton','Silk Sonic']],

  // ── FILMS / SÉRIES ───────────────────────────────────────────────
  ['Films du MCU Marvel', ['Iron Man','The Avengers','Guardians of the Galaxy','Captain America Civil War','Black Panther','Avengers Infinity War','Avengers Endgame','Spider-Man Homecoming','Thor Ragnarok','Doctor Strange','Captain America TFA','Ant-Man','Captain Marvel','Shang-Chi','No Way Home']],
  ['Films Star Wars', ['A New Hope','The Empire Strikes Back','Return of the Jedi','The Phantom Menace','Attack of the Clones','Revenge of the Sith','The Force Awakens','The Last Jedi','The Rise of Skywalker','Rogue One','Solo','The Clone Wars Movie','Caravan of Courage','Battle for Endor','The Holiday Special']],
  ['Films Harry Potter', ['La Pierre Philosophale','La Chambre des Secrets','Le Prisonnier d\'Azkaban','La Coupe de Feu','L\'Ordre du Phénix','Le Prince de Sang-Mêlé','Les Reliques de la Mort 1','Les Reliques de la Mort 2','Les Animaux Fantastiques','Les Crimes de Grindelwald','Les Secrets de Dumbledore']],
  ['Films Disney classiques', ['Le Roi Lion','Aladdin','La Belle et la Bête','La Petite Sirène','Mulan','Tarzan','Raiponce','Vaiana','La Reine des Neiges','Cendrillon','Blanche-Neige','La Belle au Bois Dormant','Pinocchio','Dumbo','Bambi','Les Aristochats','Robin des Bois','Pocahontas']],
  ['Films de Christopher Nolan', ['Memento','Insomnia','Batman Begins','The Prestige','The Dark Knight','Inception','The Dark Knight Rises','Interstellar','Dunkirk','Tenet','Oppenheimer','Following','Tarantella','Doodlebug','Quay']],
  ['Films d\'horreur cultes', ['Psycho','The Shining','Halloween','A Nightmare on Elm Street','Friday the 13th','Scream','The Exorcist','The Texas Chain Saw Massacre','It','Get Out','Hereditary','Midsommar','The Conjuring','Sinister','Insidious','The Ring','The Grudge','Paranormal Activity']],
  ['Films James Bond', ['Dr. No','Goldfinger','Thunderball','On Her Majesty\'s Secret Service','Live and Let Die','The Spy Who Loved Me','Moonraker','For Your Eyes Only','GoldenEye','Casino Royale','Skyfall','Spectre','No Time to Die','Quantum of Solace','Tomorrow Never Dies']],
  ['Séries Netflix', ['Stranger Things','Ozark','Narcos','Money Heist','Dark','Squid Game','Breaking Bad','Better Call Saul','House of Cards','Orange Is the New Black','Sex Education','The Witcher','Bridgerton','Lupin','Emily in Paris','Mindhunter','Peaky Blinders','Black Mirror']],
  ['Personnages de Game of Thrones', ['Jon Snow','Daenerys Targaryen','Tyrion Lannister','Cersei Lannister','Jaime Lannister','Arya Stark','Ned Stark','Sansa Stark','Robb Stark','The Hound','Joffrey Baratheon','Margaery Tyrell','Tywin Lannister','Oberyn Martell','Littlefinger','Varys','Theon','Brienne']],
  ['Personnages de Breaking Bad', ['Walter White','Jesse Pinkman','Skyler White','Hank Schrader','Mike Ehrmantraut','Saul Goodman','Gustavo Fring','Tuco Salamanca','Hector Salamanca','Jane Margolis','Badger','Skinny Pete','Andrea','Brock','Marie','Lydia','Todd','Walt Jr.']],
  ['Films Pixar', ['Toy Story','Monsters Inc','Finding Nemo','The Incredibles','Cars','Ratatouille','WALL-E','Up','Toy Story 3','Brave','Inside Out','Coco','Soul','Luca','Turning Red','Lightyear','Elemental','A Bug\'s Life']],
  ['Films de Quentin Tarantino', ['Reservoir Dogs','Pulp Fiction','Jackie Brown','Kill Bill Vol.1','Kill Bill Vol.2','Inglourious Basterds','Django Unchained','The Hateful Eight','Once Upon a Time in Hollywood','Four Rooms','True Romance','Natural Born Killers','From Dusk Till Dawn','Sin City','Grindhouse']],
  ['Séries animées américaines', ['Les Simpsons','Family Guy','South Park','Futurama','Bob\'s Burgers','American Dad','Archer','Rick and Morty','BoJack Horseman','Big Mouth','Beavis and Butt-Head','King of the Hill','Gravity Falls','Adventure Time','Regular Show','Steven Universe','The Loud House','We Bare Bears']],

  // ── NOURRITURE ───────────────────────────────────────────────────
  ['Plats italiens', ['Pizza Margherita','Spaghetti Carbonara','Lasagne','Risotto','Osso Buco','Tiramisu','Ravioli','Gnocchi','Minestrone','Bruschetta','Arancini','Panna Cotta','Cannoli','Polenta','Saltimbocca','Bistecca','Calzone','Focaccia']],
  ['Chaînes de fast-food', ['McDonald\'s','Burger King','KFC','Subway','Pizza Hut','Domino\'s','Taco Bell','Wendy\'s','Five Guys','Shake Shack','In-N-Out','Chipotle','Popeyes','Chick-fil-A','Tim Hortons','Quick','Paul','Five Guys']],
  ['Plats français', ['Bœuf Bourguignon','Coq au Vin','Bouillabaisse','Cassoulet','Ratatouille','Soufflé','Quiche Lorraine','Crêpes','Escargots','Foie Gras','Macarons','Crème Brûlée','Tarte Tatin','Confit de Canard','Pot-au-Feu','Blanquette de Veau','Croissant','Pain au Chocolat']],
  ['Types de pizzas', ['Margherita','Quatre Fromages','Calzone','Diavola','Reine','Napolitaine','Hawaïenne','Végétarienne','Pepperoni','Capricciosa','Paysanne','Provençale','Orientale','Nordique','Florentine','Funghi','Prosciutto','Méridionale']],
  ['Types de sushis', ['Nigiri Saumon','Maki California','Temaki Thon','Uramaki Crevette','Chirashi','Dragon Roll','Philadelphia Roll','Rainbow Roll','Tataki','Sashimi','Gunkan','Futomaki','Hosomaki','Inari','Spider Roll','Tiger Roll','Oshi Sushi','Temari']],
  ['Desserts', ['Tiramisu','Crème Brûlée','Macarons','Éclair au Chocolat','Mille-Feuille','Tarte Tatin','Fondant au Chocolat','Mousse au Chocolat','Profiteroles','Baba au Rhum','Paris-Brest','Saint-Honoré','Crêpe Suzette','Bûche de Noël','Île Flottante','Fraisier','Opéra','Charlotte']],
  ['Céréales du matin', ['Corn Flakes','Frosties','Coco Pops','Froot Loops','Lucky Charms','Cheerios','Muesli','Special K','Granola','Rice Krispies','Honey Smacks','Chocapic','Cookie Crisp','Cap\'n Crunch','Reese\'s Puffs','All-Bran','Frosted Mini-Wheats','Krave']],
  ['Sodas', ['Coca-Cola','Pepsi','Sprite','7Up','Mountain Dew','Dr Pepper','Fanta Orange','Fanta Citron','Orangina','Perrier Citron','Schweppes Agrumes','Ice Tea Pêche','Oasis Tropical','Gini','BreizhCola','Fever-Tree','Limonade','Arizona']],
  ['Fromages français', ['Brie','Camembert','Roquefort','Comté','Reblochon','Époisses','Munster','Beaufort','Ossau-Iraty','Cantal','Morbier','Livarot','Maroilles','Saint-Nectaire','Banon','Emmental','Bleu d\'Auvergne','Tomme de Savoie']],

  // ── SPORT ────────────────────────────────────────────────────────
  ['Joueurs de foot français', ['Zinedine Zidane','Thierry Henry','Michel Platini','Just Fontaine','Raymond Kopa','Laurent Blanc','Lilian Thuram','Patrick Vieira','Didier Deschamps','David Trezeguet','Youri Djorkaeff','Robert Pires','Franck Ribéry','Karim Benzema','Kylian Mbappé','Antoine Griezmann','Paul Pogba','N\'Golo Kanté']],
  ['Clubs de Ligue 1', ['Paris Saint-Germain','Olympique de Marseille','Olympique Lyonnais','AS Monaco','LOSC Lille','Stade Rennais','OGC Nice','RC Lens','Montpellier HSC','Girondins de Bordeaux','AS Saint-Étienne','RC Strasbourg','FC Nantes','FC Metz','Stade de Reims','Toulouse FC','FC Lorient','AJ Auxerre']],
  ['Joueurs de tennis', ['Roger Federer','Rafael Nadal','Novak Djokovic','Pete Sampras','Andre Agassi','John McEnroe','Boris Becker','Stefan Edberg','Jimmy Connors','Ivan Lendl','Carlos Alcaraz','Jannik Sinner','Serena Williams','Steffi Graf','Martina Navratilova','Chris Evert','Monica Seles','Kim Clijsters']],
  ['Joueurs NBA', ['Michael Jordan','LeBron James','Kobe Bryant','Shaquille O\'Neal','Magic Johnson','Larry Bird','Kareem Abdul-Jabbar','Tim Duncan','Kevin Durant','Stephen Curry','Dirk Nowitzki','Charles Barkley','Hakeem Olajuwon','Allen Iverson','Scottie Pippen','Dennis Rodman','Dwyane Wade','Vince Carter']],
  ['Pilotes de Formule 1', ['Michael Schumacher','Ayrton Senna','Lewis Hamilton','Alain Prost','Niki Lauda','Jim Clark','Juan Manuel Fangio','Mika Häkkinen','Sebastian Vettel','Max Verstappen','Fernando Alonso','Nigel Mansell','Jackie Stewart','Gilles Villeneuve','Jenson Button','Kimi Räikkönen','Charles Leclerc','Carlos Sainz']],
  ['Catcheurs WWE', ['The Rock','Stone Cold Steve Austin','John Cena','The Undertaker','Triple H','Shawn Michaels','Bret Hart','Hulk Hogan','Randy Savage','Ric Flair','Kurt Angle','Chris Jericho','Edge','Batista','Randy Orton','Rey Mysterio','Roman Reigns','CM Punk']],
  ['Clubs de Champions League', ['Real Madrid','Barcelona','Bayern Munich','Manchester United','Liverpool','AC Milan','Juventus','Chelsea','Inter Milan','Borussia Dortmund','Ajax','Porto','Benfica','Paris Saint-Germain','Manchester City','Atlético Madrid','Arsenal','Roma']],
  ['Sports olympiques', ['100 mètres','Marathon','Natation','Cyclisme','Tennis','Handball','Basketball','Volleyball','Judo','Escrime','Boxe','Athlétisme','Tir à l\'arc','Gymnastique','Haltérophilie','Lutte','Pentathlon','Équitation']],
  ['Boxeurs historiques', ['Muhammad Ali','Mike Tyson','Joe Louis','Rocky Marciano','Sugar Ray Robinson','Floyd Mayweather','Manny Pacquiao','Oscar De La Hoya','Roberto Durán','Marvin Hagler','Thomas Hearns','Evander Holyfield','Lennox Lewis','Joe Frazier','George Foreman','Larry Holmes','Wladimir Klitschko','Vitali Klitschko']],
  ['Footballeurs légendaires', ['Pelé','Diego Maradona','Ronaldo Nazário','Ronaldinho','Zinedine Zidane','Lionel Messi','Cristiano Ronaldo','Johan Cruyff','Eusébio','Gerd Müller','Franz Beckenbauer','Marco van Basten','Romário','Roberto Carlos','Paolo Maldini','Lev Yashin','George Best','Michel Platini']],

  // ── DIVERS ───────────────────────────────────────────────────────
  ['Marques de téléphones', ['Apple','Samsung','Xiaomi','Huawei','OnePlus','Google Pixel','Sony','Nokia','Motorola','Oppo','Vivo','Realme','BlackBerry','HTC','Asus ROG','Fairphone','Nothing','Tecno']],
  ['Réseaux sociaux', ['Instagram','TikTok','X (Twitter)','Facebook','YouTube','Snapchat','Discord','Reddit','LinkedIn','Pinterest','Telegram','WhatsApp','Twitch','BeReal','Mastodon','Threads','Bluesky','Tumblr']],
  ['Marques de vêtements', ['Nike','Adidas','Supreme','Off-White','Balenciaga','Gucci','Louis Vuitton','Stone Island','Palace','Stüssy','Carhartt WIP','The North Face','Lacoste','Ralph Lauren','Tommy Hilfiger','Calvin Klein','Versace','Balmain']],
  ['Voitures de sport', ['Ferrari 488 GTB','Lamborghini Huracán','Porsche 911 GT3','McLaren 720S','Bugatti Chiron','Koenigsegg Agera','Pagani Huayra','Aston Martin Vantage','Corvette Z06','Dodge Viper','Ford GT','Jaguar F-Type','Maserati GranTurismo','Alfa Romeo 4C','Lotus Evija','Rimac Nevera','Mercedes AMG GT','BMW M8']],
  ['Présidents français', ['Charles de Gaulle','Georges Pompidou','Valéry Giscard d\'Estaing','François Mitterrand','Jacques Chirac','Nicolas Sarkozy','François Hollande','Emmanuel Macron','René Coty','Vincent Auriol','Adolphe Thiers','Patrice de Mac-Mahon','Jules Grévy','Sadi Carnot','Félix Faure','Armand Fallières','Raymond Poincaré','Paul Doumer']],
  ['Planètes et corps célestes', ['Mercure','Vénus','Terre','Mars','Jupiter','Saturne','Uranus','Neptune','Pluton','Éris','Cérès','Makemake','Haumea','Sedna','Quaoar','Orcus','Triton','Charon']],
  ['Créatures mythologiques', ['Dragon','Phénix','Licorne','Basilic','Méduse','Minotaure','Centaure','Sirène','Golem','Griffon','Hippogriffe','Pégase','Chimère','Manticore','Hydre','Léviathan','Behémoth','Kirin']],
  ['Comédiens français', ['Louis de Funès','Bourvil','Fernandel','Pierre Richard','Coluche','Jean-Paul Belmondo','Raimu','Michel Serrault','Michel Galabru','Jean Rochefort','Gérard Depardieu','Yves Montand','Philippe Noiret','Claude Brasseur','Jean Carmet','Pierre Mondy','Michel Blanc','Jacques Villeret']],
  ['Pays européens', ['France','Allemagne','Espagne','Italie','Portugal','Pays-Bas','Belgique','Suisse','Autriche','Pologne','Suède','Norvège','Danemark','Finlande','Grèce','Turquie','Ukraine','Roumanie']],
  ['Cocktails populaires', ['Mojito','Margarita','Cosmopolitan','Sex on the Beach','Long Island Iced Tea','Piña Colada','Daiquiri','Cuba Libre','Bloody Mary','Aperol Spritz','Negroni','Old Fashioned','Manhattan','Whisky Sour','Gin Tonic','French 75','Sidecar','Bellini']],
  ['Marques de sneakers', ['Nike Air Force 1','Adidas Yeezy','Air Jordan 1','New Balance 550','Converse Chuck Taylor','Vans Old Skool','Reebok Club C','Puma Suede','Balenciaga Triple S','Asics Gel-Lyte','Saucony Jazz','Fila Disruptor','Diadora N9000','Mizuno Wave Rider','Brooks Ghost','HOKA Clifton','Salomon Speedcross','New Balance 990']],
  ['Instruments de musique', ['Guitare électrique','Batterie','Piano','Basse électrique','Violon','Saxophone','Trompette','Flûte traversière','Clarinette','Trombone','Accordéon','Banjo','Mandoline','Ukulélé','Cor français','Tuba','Contrebasse','Harpe']],
  ['Styles de danse', ['Hip-Hop','Ballet classique','Flamenco','Salsa','Tango','Breakdance','Danse contemporaine','Valse','Quickstep','Cha-Cha','Bachata','Zouk','Kizomba','Lindy Hop','Swing','Claquettes','Bollywood','Capoeira']],
  ['Jeux de société', ['Monopoly','Scrabble','Risk','Catan','Carcassonne','Pandemic','Dixit','7 Wonders','Ticket to Ride','Codenames','Terraforming Mars','Azul','Wingspan','Splendor','Coup','Love Letter','Hanabi','Secret Hitler']],
  ['Personnages d\'Harry Potter', ['Harry Potter','Hermione Granger','Ron Weasley','Albus Dumbledore','Lord Voldemort','Severus Snape','Draco Malfoy','Luna Lovegood','Neville Longbottom','Sirius Black','Rubeus Hagrid','Minerva McGonagall','Bellatrix Lestrange','Remus Lupin','Nymphadora Tonks','Fred Weasley','George Weasley','Ginny Weasley']],
  ['Personnages des Avengers', ['Iron Man','Captain America','Thor','Hulk','Black Widow','Hawkeye','Ant-Man','Wasp','Vision','Scarlet Witch','Spider-Man','Black Panther','Doctor Strange','War Machine','Falcon','Winter Soldier','Captain Marvel','Guardians']],
  ['Superhéros DC Comics', ['Superman','Batman','Wonder Woman','The Flash','Green Lantern','Aquaman','Cyborg','Green Arrow','Shazam','Batgirl','Nightwing','Red Hood','Blue Beetle','Booster Gold','Zatanna','Martian Manhunter','Hawkman','Hawkgirl']],
  ['Vilains Marvel', ['Thanos','Loki','Magneto','Doctor Doom','Red Skull','Green Goblin','Venom','Carnage','Ultron','Galactus','Apocalypse','Mephisto','Dormammu','Baron Mordo','Hela','Killmonger','Mysterio','Vulture']],
];

// Génération des 1000 tierlists (100 thèmes × 10 éditions)
const TIERLISTS = [];

for (let t = 0; t < THEMES.length; t++) {
  const [name, items] = THEMES[t];
  for (let v = 0; v < 10; v++) {
    const seed = t * 1000 + v + 31337;
    const sh = seededShuffle(items, seed);
    const n = sh.length;
    const c0 = Math.max(1, Math.floor(n * 0.15));
    const c1 = Math.max(c0 + 1, Math.floor(n * 0.35));
    const c2 = Math.max(c1 + 1, Math.floor(n * 0.60));
    const c3 = Math.max(c2 + 1, Math.floor(n * 0.80));
    TIERLISTS.push({
      title: `${name} — ${EDITIONS[v]}`,
      num: t * 10 + v + 1,
      tiers: {
        '🏆 S': sh.slice(0, c0),
        '⭐ A': sh.slice(c0, c1),
        '✅ B': sh.slice(c1, c2),
        '🔵 C': sh.slice(c2, c3),
        '❌ D': sh.slice(c3),
      },
    });
  }
}

const CATEGORIES = [
  { emoji: '🎌', name: 'Anime',          themes: THEMES.slice(0, 20) },
  { emoji: '🎮', name: 'Gaming',         themes: THEMES.slice(20, 35) },
  { emoji: '🎵', name: 'Musique',        themes: THEMES.slice(35, 50) },
  { emoji: '🎬', name: 'Films & Séries', themes: THEMES.slice(50, 63) },
  { emoji: '🍕', name: 'Nourriture',     themes: THEMES.slice(63, 72) },
  { emoji: '⚽', name: 'Sport',          themes: THEMES.slice(72, 82) },
  { emoji: '✨', name: 'Divers',         themes: THEMES.slice(82) },
];

module.exports = { TIERLISTS, CATEGORIES };
